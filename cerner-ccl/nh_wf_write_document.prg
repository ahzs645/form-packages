;******************************************************************************
; nh_wf_write_document.prg
;
; Custom script (dispatch via nh_wf_entry whitelist): files a completed web
; form into the chart as a clinical document through Cerner's supported
; mmf_publish_ce API. Never writes clinical_event directly.
;
; Called from nh_wf_entry:group1 — do not run stand-alone. Parameters arrive
; at payload->customscript->script[nSCRIPT]->parameters:
;   eventKey   : code set 72 DISPLAYKEY the document files under
;   title      : document title (non-blank)
;   document   : HTML/text body; "\n" sequences become char(10)
;   noteFormat : code set 23 CDF_MEANING (e.g. "AH" auth HTML)
;
; Result (echoed under the request's id):
;   { "status": "success"|"<error text>", "statusValue": i4,
;     "parentEventId": f8 }
;
; !! SITE REVIEW (blocking): the mmf_publish_ce REQUEST/REPLY record layouts
;    below are declared from observed usage, not from the Cerner include.
;    Before first compile, open mmf_publish_ce in DVDev and align every
;    field name; likewise confirm code sets 21 (action type) and 103
;    (action status) meanings used for the PERFORM/SIGN/VERIFY rows.
;******************************************************************************
drop program nh_wf_write_document:group1 go
create program nh_wf_write_document:group1

declare cEVENT_KEY   = vc with noconstant("")
declare cTITLE       = vc with noconstant("")
declare cDOCUMENT    = vc with noconstant("")
declare cNOTE_FORMAT = vc with noconstant("")
declare fEVENT_CD    = f8 with noconstant(0.0)
declare fFORMAT_CD   = f8 with noconstant(0.0)
declare nPRSNL       = i4 with noconstant(0)
declare nSTAT        = i4 with noconstant(0)

record rRESULT (
    1 status          = vc
    1 status_value    = i4
    1 parent_event_id = f8
)

subroutine DOC_FAIL(cWHY)
    set rRESULT->status = cWHY
    set rRESULT->status_value = 0
    call ADD_CUSTOM_OUTPUT(cnvtrectojson(rRESULT, 4, 1))
end

; ---- parameters -----------------------------------------------------------
if (validate(payload->customscript->script[nSCRIPT]->parameters.eventkey))
    set cEVENT_KEY = trim(payload->customscript->script[nSCRIPT]->parameters.eventkey, 3)
endif
if (validate(payload->customscript->script[nSCRIPT]->parameters.title))
    set cTITLE = trim(payload->customscript->script[nSCRIPT]->parameters.title, 3)
endif
if (validate(payload->customscript->script[nSCRIPT]->parameters.document))
    set cDOCUMENT = payload->customscript->script[nSCRIPT]->parameters.document
endif
if (validate(payload->customscript->script[nSCRIPT]->parameters.noteformat))
    set cNOTE_FORMAT = trim(payload->customscript->script[nSCRIPT]->parameters.noteformat, 3)
endif

; ---- validation -----------------------------------------------------------
if (size(patient_source->visits, 5) != 1)
    call DOC_FAIL("Exactly one patient_source visit is required")
    go to end_script
endif
if (patient_source->visits[1].person_id <= 0.0
    or patient_source->visits[1].encntr_id <= 0.0)
    call DOC_FAIL("A valid person and encounter are required")
    go to end_script
endif
if (cTITLE <= " ")
    call DOC_FAIL("Blank title not allowed")
    go to end_script
endif
if (trim(cDOCUMENT) <= " ")
    call DOC_FAIL("Blank document content not allowed")
    go to end_script
endif

set fEVENT_CD = uar_get_code_by("DISPLAYKEY", 72, nullterm(cEVENT_KEY))
if (fEVENT_CD <= 0.0)
    call DOC_FAIL(concat("Invalid event key: ", cEVENT_KEY))
    go to end_script
endif
set fFORMAT_CD = uar_get_code_by("MEANING", 23, nullterm(cNOTE_FORMAT))
if (fFORMAT_CD <= 0.0)
    call DOC_FAIL(concat("Invalid note format: ", cNOTE_FORMAT))
    go to end_script
endif

; ---- mmf_publish_ce request ----------------------------------------------
; !! SITE REVIEW: align this record with the domain's mmf_publish_ce.
free record mmf_publish_ce_request
record mmf_publish_ce_request (
    1 person_id       = f8
    1 encntr_id       = f8
    1 event_cd        = f8
    1 event_title     = vc
    1 note_format_cd  = f8
    1 notetext        = vc
    1 publishasnote   = i4
    1 debug           = i4
    1 prsnl_list[*]
        2 action_type_cd    = f8
        2 action_status_cd  = f8
        2 action_prsnl_id   = f8
)
free record mmf_publish_ce_reply
record mmf_publish_ce_reply (
    1 status          = vc
    1 status_value    = i4
    1 parent_event_id = f8
)

set mmf_publish_ce_request->person_id = patient_source->visits[1].person_id
set mmf_publish_ce_request->encntr_id = patient_source->visits[1].encntr_id
set mmf_publish_ce_request->event_cd = fEVENT_CD
set mmf_publish_ce_request->event_title = cTITLE
set mmf_publish_ce_request->note_format_cd = fFORMAT_CD
set mmf_publish_ce_request->notetext = replace(cDOCUMENT, "\n", char(10))
set mmf_publish_ce_request->publishasnote = 0
set mmf_publish_ce_request->debug = 0

subroutine DOC_ADD_PRSNL(cACTION, cSTATUS, fPRSNL)
    set nPRSNL = size(mmf_publish_ce_request->prsnl_list, 5) + 1
    set nSTAT = alterlist(mmf_publish_ce_request->prsnl_list, nPRSNL)
    set mmf_publish_ce_request->prsnl_list[nPRSNL].action_type_cd =
        uar_get_code_by("MEANING", 21, nullterm(cACTION))
    set mmf_publish_ce_request->prsnl_list[nPRSNL].action_status_cd =
        uar_get_code_by("MEANING", 103, nullterm(cSTATUS))
    set mmf_publish_ce_request->prsnl_list[nPRSNL].action_prsnl_id = fPRSNL
end

; The filing user performs, signs, and verifies. Identity comes from the
; authenticated session only.
call DOC_ADD_PRSNL("PERFORM", "COMPLETED", reqinfo->updt_id)
call DOC_ADD_PRSNL("SIGN", "COMPLETED", reqinfo->updt_id)
call DOC_ADD_PRSNL("VERIFY", "COMPLETED", reqinfo->updt_id)

execute mmf_publish_ce
    with replace("REQUEST", mmf_publish_ce_request),
         replace("REPLY", mmf_publish_ce_reply)

set rRESULT->status = mmf_publish_ce_reply->status
set rRESULT->status_value = mmf_publish_ce_reply->status_value
set rRESULT->parent_event_id = mmf_publish_ce_reply->parent_event_id
if (rRESULT->status <= " ")
    set rRESULT->status = "success"
endif
call ADD_CUSTOM_OUTPUT(cnvtrectojson(rRESULT, 4, 1))

#end_script
end
go
