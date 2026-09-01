;******************************************************************************
; nh_wf_entry.prg
;
; Entry point for Northern Health webforms MPage pages/components.
; Clean-room implementation of the blob/prompt entry-script contract spoken
; by @webforms/cerner-core CclClient. No vendor code.
;
; Request:  JSON blob (hex-encoded when config.hexMode) shaped
;             {"payload": { patientSource, person, encounter,
;                           customScript: {script:[{name,id,run,parameters}]},
;                           clearPatientSource }}
; Reply:    {"runStats":{...},"chartId":{...},"errors":[...],
;             ["persons":[...]] ["encounters":[...]]
;             ["customPre":[...]] ["customPost":[...]] }
;
; Security (deliberate deltas from prior art):
;   - custom scripts run only if listed in cWHITELIST
;   - every patient_source entry passes CHECK_ENTITLEMENT before use
;   - the acting user is always REQINFO->UPDT_ID (client value ignored)
;
; !! SITE REVIEW: compile in a non-prod domain first; confirm code-set and
;    column assumptions flagged below with the apps team.
;******************************************************************************
drop program nh_wf_entry:group1 go
create program nh_wf_entry:group1

prompt
    "Output to File/Printer/MINE" = "MINE"
    , "Person ID" = 0
    , "Encounter ID" = 0
    , "Debug Indicator" = 0
    , "Process ID" = 0
    , "Extra Configuration Information" = ""
with OUTDEV, PERSON_ID, ENCNTR_ID, DEBUG_IND, ID, CONFIG

; -------------------------------------------------------------------------
; Only scripts named here may be dispatched from payload->customScript.
; Pipe-delimited, lower case, include the group suffix.
; -------------------------------------------------------------------------
declare cWHITELIST = vc with noconstant(concat(
    "|nh_wf_write_document:group1",
    "|nh_wf_form_store:group1",
    "|"))

; Set to 1 to additionally require an active prsnl_org_reltn overlap between
; the acting user and the encounter's organization. !! SITE REVIEW: enable
; per NH access policy once confirmed against real security data.
declare nORG_SECURITY = i4 with noconstant(0)

declare nSCRIPT     = i4 with noconstant(0)
declare cERRORS     = vc with noconstant("")
declare cDOMAINS    = vc with noconstant("")
declare cCUSTOM_PRE = vc with noconstant("")
declare cCUSTOM_POST = vc with noconstant("")
declare cRAW_BLOB   = vc with noconstant("")
declare nSTAT       = i4 with noconstant(0)
declare nLOOP       = i4 with noconstant(0)
declare nVISIT      = i4 with noconstant(0)
declare nOK         = i4 with noconstant(0)

record run_stats (
    1 id            = i4
    1 start_time    = dq8
    1 end_time      = dq8
    1 status        = vc
    1 hex_mode      = i4
    1 domain        = vc
    1 node          = vc
    1 prsnl_id      = f8
    1 prsnl_name    = vc
    1 physician_ind = i4
    1 position_cd   = f8
    1 position      = vc
    1 username      = vc
)

record chart_id (
    1 person_id             = f8
    1 encntr_id             = f8
    1 name_full_formatted   = vc
)

record patient_source (
    1 visits[*]
        2 person_id = f8
        2 encntr_id = f8
    1 patients[*]
        2 person_id = f8
)

; Populated on demand by the person/encounter sections
record rPERSONS (
    1 persons[*]
        2 person_id             = f8
        2 name_full_formatted   = vc
        2 name_first            = vc
        2 name_last             = vc
        2 birth_dt_tm           = dq8
        2 gender_cd             = f8
        2 gender                = vc
        2 deceased_ind          = i4
        2 aliases[*]
            3 alias         = vc
            3 alias_type_cd = f8
            3 alias_type    = vc
)

record rENCOUNTERS (
    1 encounters[*]
        2 encntr_id         = f8
        2 person_id         = f8
        2 encntr_type_cd    = f8
        2 encntr_type       = vc
        2 loc_facility_cd   = f8
        2 location          = vc
        2 reg_dt_tm         = dq8
        2 aliases[*]
            3 alias         = vc
            3 alias_type_cd = f8
            3 alias_type    = vc
)

set run_stats->id = $ID
set run_stats->start_time = sysdate
set run_stats->domain = curdomain
set run_stats->node = curnode
set run_stats->prsnl_id = reqinfo->updt_id

; -------------------------------------------------------------------------
; Config (6th prompt): {"mode":"CHART","hexMode":false}
; -------------------------------------------------------------------------
if (trim($CONFIG) > " ")
    set nSTAT = cnvtjsontorec(concat(^{"config":^, $CONFIG, ^}^), 0, 0, 1)
endif
if (validate(config->hexMode, 0) = 1)
    set run_stats->hex_mode = 1
endif

; -------------------------------------------------------------------------
; Acting user comes from the session, never from the client.
; -------------------------------------------------------------------------
select into "nl:"
from prsnl p
plan p
    where p.person_id = run_stats->prsnl_id
detail
    run_stats->prsnl_name = p.name_full_formatted
    run_stats->position_cd = p.position_cd
    run_stats->position = uar_get_code_display(p.position_cd)
    run_stats->physician_ind = p.physician_ind
    run_stats->username = p.username
with counter

; -------------------------------------------------------------------------
; Request blob -> PAYLOAD record
; -------------------------------------------------------------------------
if (validate(REQUEST->BLOB_IN))
    if (REQUEST->BLOB_IN > " ")
        if (run_stats->hex_mode = 1)
            set cRAW_BLOB = cnvthexraw(REQUEST->BLOB_IN)
        else
            set cRAW_BLOB = REQUEST->BLOB_IN
        endif
        set nSTAT = cnvtjsontorec(cRAW_BLOB, 0, 0, 1)
    endif
endif

; Debug mode: persist the raw request for inspection and do nothing else.
if ($DEBUG_IND > 0)
    call echojson(payload, concat("cclscratch:nh_wf_debug_",
        trim(cnvtstring(reqinfo->updt_id)), ".json"))
    set run_stats->status = "Debug: request captured, services skipped"
    go to build_reply
endif

; -------------------------------------------------------------------------
; Subroutines
; -------------------------------------------------------------------------
subroutine ADD_ERROR(nCODE, cMESSAGE)
    if (cERRORS > " ")
        set cERRORS = concat(cERRORS, ",")
    endif
    set cERRORS = concat(cERRORS,
        ^{"code":^, trim(cnvtstring(nCODE)),
        ^,"message":"^, replace(trim(cMESSAGE), ^"^, ^\"^), ^"}^)
end

; Strip the outer braces from a CNVTRECTOJSON result so sections can be
; spliced into one reply object.
subroutine FIXJSON(cJSON)
    declare cOUT = vc with noconstant("")
    set cOUT = trim(cJSON, 3)
    if (substring(1, 1, cOUT) = "{")
        set cOUT = substring(2, size(cOUT) - 2, cOUT)
    endif
    return(cOUT)
end

; Custom scripts hand their result here as CNVTRECTOJSON(rec, 4, 1); the
; wrapper key is dropped so the reply carries {"id":..., "data":{...}}.
subroutine ADD_CUSTOM_OUTPUT(cJSON)
    declare nPOS = i4 with noconstant(0)
    declare cDATA = vc with noconstant("{}")
    declare cENTRY = vc with noconstant("")
    set nPOS = findstring(":", cJSON)
    if (nPOS > 0)
        set cDATA = substring(nPOS + 1, (size(cJSON) - nPOS) - 1, cJSON)
    endif
    set cENTRY = concat(^{"id":"^,
        trim(payload->customscript->script[nSCRIPT].id), ^","data":^, cDATA, ^}^)
    if (cnvtlower(payload->customscript->script[nSCRIPT].run) = "post")
        if (cCUSTOM_POST > " ")
            set cCUSTOM_POST = concat(cCUSTOM_POST, ",")
        endif
        set cCUSTOM_POST = concat(cCUSTOM_POST, cENTRY)
    else
        if (cCUSTOM_PRE > " ")
            set cCUSTOM_PRE = concat(cCUSTOM_PRE, ",")
        endif
        set cCUSTOM_PRE = concat(cCUSTOM_PRE, cENTRY)
    endif
end

; Entitlement: the person must exist; a supplied encounter must belong to
; that person; optionally the acting user must share an org with the
; encounter. Returns 1 when access is allowed.
subroutine CHECK_ENTITLEMENT(nPERSON, nENCNTR)
    declare nALLOWED = i4 with noconstant(0)
    declare nORG_OK  = i4 with noconstant(1)

    if (nPERSON <= 0.0)
        return(0)
    endif

    if (nENCNTR > 0.0)
        select into "nl:"
        from encounter e
        plan e
            where e.encntr_id = nENCNTR
            and e.person_id = nPERSON
            and e.active_ind = 1
        detail
            nALLOWED = 1
            if (nORG_SECURITY = 1)
                nORG_OK = 0
                select into "nl:"
                from prsnl_org_reltn por
                plan por
                    where por.person_id = reqinfo->updt_id
                    and por.organization_id = e.organization_id
                    and por.active_ind = 1
                    and por.end_effective_dt_tm > sysdate
                detail
                    nORG_OK = 1
                with counter
            endif
        with counter
        if (nORG_OK = 0)
            set nALLOWED = 0
        endif
    else
        select into "nl:"
        from person p
        plan p
            where p.person_id = nPERSON
            and p.active_ind = 1
        detail
            nALLOWED = 1
        with counter
    endif
    return(nALLOWED)
end

; -------------------------------------------------------------------------
; Chart context: payload patientSource wins, else the prompt values
; (PowerChart macro substitution already resolved them).
; -------------------------------------------------------------------------
if (validate(payload->patientsource) = 1)
    for (nLOOP = 1 to size(payload->patientsource, 5))
        if (payload->patientsource[nLOOP].personid > 0.0
            or payload->patientsource[nLOOP].encntrid > 0.0)
            set nVISIT = size(patient_source->visits, 5) + 1
            set nSTAT = alterlist(patient_source->visits, nVISIT)
            set patient_source->visits[nVISIT].person_id =
                payload->patientsource[nLOOP].personid
            set patient_source->visits[nVISIT].encntr_id =
                payload->patientsource[nLOOP].encntrid
        endif
    endfor
endif
if (size(patient_source->visits, 5) = 0 and $PERSON_ID > 0.0)
    set nSTAT = alterlist(patient_source->visits, 1)
    set patient_source->visits[1].person_id = $PERSON_ID
    set patient_source->visits[1].encntr_id = $ENCNTR_ID
endif

; Backfill person from encounter, then enforce entitlement on every entry.
for (nLOOP = 1 to size(patient_source->visits, 5))
    if (patient_source->visits[nLOOP].person_id <= 0.0
        and patient_source->visits[nLOOP].encntr_id > 0.0)
        select into "nl:"
        from encounter e
        plan e
            where e.encntr_id = patient_source->visits[nLOOP].encntr_id
        detail
            patient_source->visits[nLOOP].person_id = e.person_id
        with counter
    endif
    set nOK = CHECK_ENTITLEMENT(
        patient_source->visits[nLOOP].person_id,
        patient_source->visits[nLOOP].encntr_id)
    if (nOK = 0)
        call ADD_ERROR(403, concat("Access denied for person ",
            trim(cnvtstring(patient_source->visits[nLOOP].person_id))))
        set patient_source->visits[nLOOP].person_id = 0.0
        set patient_source->visits[nLOOP].encntr_id = 0.0
    endif
endfor

if (size(patient_source->visits, 5) > 0)
    set chart_id->person_id = patient_source->visits[1].person_id
    set chart_id->encntr_id = patient_source->visits[1].encntr_id
    select into "nl:"
    from person p
    plan p
        where p.person_id = chart_id->person_id
    detail
        chart_id->name_full_formatted = p.name_full_formatted
    with counter
endif

; -------------------------------------------------------------------------
; Custom script dispatch (pre)
; -------------------------------------------------------------------------
subroutine RUN_CUSTOM(cPHASE)
    declare cNAME = vc with noconstant("")
    declare cSAVE_REPLY = vc with noconstant("")
    if (validate(payload->customscript) = 0)
        return(0)
    endif
    for (nSCRIPT = 1 to size(payload->customscript->script, 5))
        if (cnvtupper(payload->customscript->script[nSCRIPT].run) = cPHASE)
            set cNAME = cnvtlower(trim(payload->customscript->script[nSCRIPT].name, 3))
            if (findstring(concat("|", cNAME, "|"), cWHITELIST) > 0)
                ; Nested executes may clobber the reply buffer; guard it.
                set cSAVE_REPLY = _Memory_Reply_String
                call parser(concat("execute ", cNAME, " go"))
                set _Memory_Reply_String = cSAVE_REPLY
            else
                call ADD_ERROR(400, concat("Script not whitelisted: ", cNAME))
            endif
        endif
    endfor
    return(1)
end

call RUN_CUSTOM("PRE")

; -------------------------------------------------------------------------
; Standard sections (prefill support): person, encounter
; -------------------------------------------------------------------------
if (validate(payload->person) = 1 and chart_id->person_id > 0.0)
    select into "nl:"
    from person p
    plan p
        where p.person_id = chart_id->person_id
    head report
        nSTAT = alterlist(rPERSONS->persons, 1)
    detail
        rPERSONS->persons[1].person_id = p.person_id
        rPERSONS->persons[1].name_full_formatted = p.name_full_formatted
        rPERSONS->persons[1].name_first = p.name_first
        rPERSONS->persons[1].name_last = p.name_last
        rPERSONS->persons[1].birth_dt_tm = p.birth_dt_tm
        rPERSONS->persons[1].gender_cd = p.sex_cd
        rPERSONS->persons[1].gender = uar_get_code_display(p.sex_cd)
        rPERSONS->persons[1].deceased_ind =
            evaluate(p.deceased_cd, 0.0, 0, 1)   ; !! SITE REVIEW: deceased_cd semantics
    with counter

    select into "nl:"
    from person_alias pa
    plan pa
        where pa.person_id = chart_id->person_id
        and pa.active_ind = 1
        and pa.end_effective_dt_tm > sysdate
    detail
        nLOOP = size(rPERSONS->persons[1].aliases, 5) + 1
        nSTAT = alterlist(rPERSONS->persons[1].aliases, nLOOP)
        rPERSONS->persons[1].aliases[nLOOP].alias = pa.alias
        rPERSONS->persons[1].aliases[nLOOP].alias_type_cd = pa.person_alias_type_cd
        rPERSONS->persons[1].aliases[nLOOP].alias_type =
            uar_get_code_display(pa.person_alias_type_cd)
    with counter

    if (cDOMAINS > " ")
        set cDOMAINS = concat(cDOMAINS, ",")
    endif
    set cDOMAINS = concat(cDOMAINS, FIXJSON(cnvtrectojson(rPERSONS, 4, 1)))
endif

if (validate(payload->encounter) = 1 and chart_id->encntr_id > 0.0)
    select into "nl:"
    from encounter e
    plan e
        where e.encntr_id = chart_id->encntr_id
    head report
        nSTAT = alterlist(rENCOUNTERS->encounters, 1)
    detail
        rENCOUNTERS->encounters[1].encntr_id = e.encntr_id
        rENCOUNTERS->encounters[1].person_id = e.person_id
        rENCOUNTERS->encounters[1].encntr_type_cd = e.encntr_type_cd
        rENCOUNTERS->encounters[1].encntr_type = uar_get_code_display(e.encntr_type_cd)
        rENCOUNTERS->encounters[1].loc_facility_cd = e.loc_facility_cd
        rENCOUNTERS->encounters[1].location = uar_get_code_display(e.loc_facility_cd)
        rENCOUNTERS->encounters[1].reg_dt_tm = e.reg_dt_tm
    with counter

    select into "nl:"
    from encntr_alias ea
    plan ea
        where ea.encntr_id = chart_id->encntr_id
        and ea.active_ind = 1
        and ea.end_effective_dt_tm > sysdate
    detail
        nLOOP = size(rENCOUNTERS->encounters[1].aliases, 5) + 1
        nSTAT = alterlist(rENCOUNTERS->encounters[1].aliases, nLOOP)
        rENCOUNTERS->encounters[1].aliases[nLOOP].alias = ea.alias
        rENCOUNTERS->encounters[1].aliases[nLOOP].alias_type_cd = ea.encntr_alias_type_cd
        rENCOUNTERS->encounters[1].aliases[nLOOP].alias_type =
            uar_get_code_display(ea.encntr_alias_type_cd)
    with counter

    if (cDOMAINS > " ")
        set cDOMAINS = concat(cDOMAINS, ",")
    endif
    set cDOMAINS = concat(cDOMAINS, FIXJSON(cnvtrectojson(rENCOUNTERS, 4, 1)))
endif

call RUN_CUSTOM("POST")

; -------------------------------------------------------------------------
; Reply assembly
; -------------------------------------------------------------------------
#build_reply
set run_stats->end_time = sysdate
if (run_stats->status <= " ")
    set run_stats->status = "ok"
endif

declare cREPLY = vc with noconstant("")
set cREPLY = concat("{",
    FIXJSON(cnvtrectojson(run_stats, 4, 1)), ",",
    FIXJSON(cnvtrectojson(chart_id, 4, 1)), ",",
    ^"errors":[^, cERRORS, ^]^)
if (cDOMAINS > " ")
    set cREPLY = concat(cREPLY, ",", cDOMAINS)
endif
if (cCUSTOM_PRE > " ")
    set cREPLY = concat(cREPLY, ^,"customPre":[^, cCUSTOM_PRE, ^]^)
endif
if (cCUSTOM_POST > " ")
    set cREPLY = concat(cREPLY, ^,"customPost":[^, cCUSTOM_POST, ^]^)
endif
set cREPLY = concat(cREPLY, "}")

; The reply can exceed the session's maximum variable length once a form
; definition or a large section is included. Grow maxvarlen to fit, write,
; then restore it so we do not leak the change into the caller's session.
declare nOrigMaxVarLen = i4 with noconstant(curmaxvarlen)
declare nNeedMaxVarLen = i4 with noconstant(0)

if (run_stats->hex_mode = 1)
    set cREPLY = cnvtrawhex(cREPLY)
endif

set nNeedMaxVarLen = textlen(cREPLY) + 1000
if (nNeedMaxVarLen > nOrigMaxVarLen)
    set modify maxvarlen nNeedMaxVarLen
endif

set _Memory_Reply_String = cREPLY

if (nNeedMaxVarLen > nOrigMaxVarLen)
    set modify maxvarlen nOrigMaxVarLen
endif

end
go
