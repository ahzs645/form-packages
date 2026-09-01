;******************************************************************************
; nh_wf_form_store.prg
;
; Custom script (dispatch via nh_wf_entry whitelist): chunked key/value store
; on cust_nh_wf_reference for form definitions, drafts, and submission
; markers. Bodies chunk at 32,000 characters across rows ordered by
; `sequence`; reads reassemble transparently.
;
; Called from nh_wf_entry:group1 — do not run stand-alone. Parameters at
; payload->customscript->script[nSCRIPT]->parameters:
;   action : "r" read active | "ra" read all | "w" write | "i" inactivate
;            | "d" hard delete
;   data   : [{ refName, refTask, description, parentEntityId,
;               parentEntityName, refText }]
; Reads match on refName/refTask (+ parentEntityId when > 0). Writes replace
; the row set for their key (shrinking chunk counts delete leftovers).
;
; Result under the request id:
;   { "rows":[{refName,refTask,description,parentEntityId,parentEntityName,
;              refText,updtDtTm}], "actionStatus":"..." }
;******************************************************************************
drop program nh_wf_form_store:group1 go
create program nh_wf_form_store:group1

declare cACTION     = vc with noconstant("r")
declare nMAX_LEN    = i4 with noconstant(32000)
declare nROW        = i4 with noconstant(0)
declare nPIECE      = i4 with noconstant(0)
declare nPIECES     = i4 with noconstant(0)
declare nIDX        = i4 with noconstant(0)
declare nSTAT       = i4 with noconstant(0)
declare cTEXT       = vc with noconstant("")
declare cPIECE_TEXT = vc with noconstant("")
declare fPARENT     = f8 with noconstant(0.0)
declare cNAME       = vc with noconstant("")
declare cTASK       = vc with noconstant("")

record rSTORE (
    1 rows[*]
        2 ref_name          = vc
        2 ref_task          = vc
        2 description       = vc
        2 parent_entity_id  = f8
        2 parent_entity_name = vc
        2 ref_text          = vc
        2 updt_dt_tm        = dq8
    1 action_status = vc
)

if (validate(payload->customscript->script[nSCRIPT]->parameters.action))
    set cACTION = cnvtlower(trim(payload->customscript->script[nSCRIPT]->parameters.action, 3))
endif

declare nDATA_CNT = i4 with noconstant(0)
if (validate(payload->customscript->script[nSCRIPT]->parameters.data) = 1)
    set nDATA_CNT = size(payload->customscript->script[nSCRIPT]->parameters.data, 5)
endif
if (nDATA_CNT = 0)
    set rSTORE->action_status = "No data rows supplied"
    call ADD_CUSTOM_OUTPUT(cnvtrectojson(rSTORE, 4, 1))
    go to end_script
endif

; -------------------------------------------------------------------------
case (cACTION)
of "r":
of "ra":
    for (nIDX = 1 to nDATA_CNT)
        set cNAME = trim(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].refname, 3)
        set cTASK = trim(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].reftask, 3)
        set fPARENT = 0.0
        if (validate(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].parententityid))
            set fPARENT = payload->customscript->script[nSCRIPT]->parameters.data[nIDX].parententityid
        endif

        select into "nl:"
        from cust_nh_wf_reference cr
        plan cr
            where cr.ref_name = cNAME
            and cr.ref_task = cTASK
            and cr.parent_entity_id = fPARENT
            and (cr.active_ind = 1 or cACTION = "ra")
        order by cr.sequence
        head report
            nROW = size(rSTORE->rows, 5) + 1
            nSTAT = alterlist(rSTORE->rows, nROW)
            rSTORE->rows[nROW].ref_name = cNAME
            rSTORE->rows[nROW].ref_task = cTASK
            rSTORE->rows[nROW].parent_entity_id = fPARENT
        detail
            rSTORE->rows[nROW].description = cr.description
            rSTORE->rows[nROW].parent_entity_name = cr.parent_entity_name
            rSTORE->rows[nROW].updt_dt_tm = cr.updt_dt_tm
            rSTORE->rows[nROW].ref_text =
                concat(trim(rSTORE->rows[nROW].ref_text), cr.ref_text)
        with counter
    endfor
    set rSTORE->action_status = "Read complete"

of "w":
    for (nIDX = 1 to nDATA_CNT)
        set cNAME = trim(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].refname, 3)
        set cTASK = trim(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].reftask, 3)
        set fPARENT = 0.0
        if (validate(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].parententityid))
            set fPARENT = payload->customscript->script[nSCRIPT]->parameters.data[nIDX].parententityid
        endif
        set cTEXT = payload->customscript->script[nSCRIPT]->parameters.data[nIDX].reftext
        set nPIECES = ((size(cTEXT) - 1) / nMAX_LEN) + 1
        if (nPIECES < 1)
            set nPIECES = 1
        endif

        ; Replace-by-key: clear the existing row set, insert fresh chunks.
        delete from cust_nh_wf_reference cr
            where cr.ref_name = cNAME
            and cr.ref_task = cTASK
            and cr.parent_entity_id = fPARENT

        for (nPIECE = 1 to nPIECES)
            set cPIECE_TEXT = substring(((nPIECE - 1) * nMAX_LEN) + 1, nMAX_LEN, cTEXT)
            insert into cust_nh_wf_reference cr
            set cr.ref_id = seq(cust_nh_wf_ref_seq, nextval),
                cr.ref_name = cNAME,
                cr.ref_task = cTASK,
                cr.description =
                    trim(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].description, 3),
                cr.parent_entity_id = fPARENT,
                cr.parent_entity_name =
                    trim(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].parententityname, 3),
                cr.sequence = nPIECE,
                cr.ref_text = cPIECE_TEXT,
                cr.active_ind = 1,
                cr.create_prsnl_id = reqinfo->updt_id,
                cr.create_dt_tm = sysdate,
                cr.updt_id = reqinfo->updt_id,
                cr.updt_dt_tm = sysdate,
                cr.beg_effective_dt_tm = sysdate,
                cr.end_effective_dt_tm = cnvtdatetime("31-DEC-2100 23:59:59")
        endfor
    endfor
    commit
    set rSTORE->action_status = "Write complete"

of "i":
    for (nIDX = 1 to nDATA_CNT)
        update into cust_nh_wf_reference cr
        set cr.active_ind = 0,
            cr.end_effective_dt_tm = sysdate,
            cr.updt_id = reqinfo->updt_id,
            cr.updt_dt_tm = sysdate
            where cr.ref_name =
                trim(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].refname, 3)
            and cr.ref_task =
                trim(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].reftask, 3)
    endfor
    commit
    set rSTORE->action_status = "Inactivate complete"

of "d":
    for (nIDX = 1 to nDATA_CNT)
        delete from cust_nh_wf_reference cr
            where cr.ref_name =
                trim(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].refname, 3)
            and cr.ref_task =
                trim(payload->customscript->script[nSCRIPT]->parameters.data[nIDX].reftask, 3)
    endfor
    commit
    set rSTORE->action_status = "Delete complete"

else
    set rSTORE->action_status = concat("Unknown action: ", cACTION)
endcase

call ADD_CUSTOM_OUTPUT(cnvtrectojson(rSTORE, 4, 1))

#end_script
end
go
