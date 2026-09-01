;******************************************************************************
; nh_wf_custom_template.prg
;
; Starting point for new webforms custom scripts. Copy, rename (keep the
; :group1 suffix), implement, then add the lower-cased name to cWHITELIST in
; nh_wf_entry.prg — nothing runs without that.
;
; Contract when dispatched by nh_wf_entry:group1:
;   - nSCRIPT indexes your entry in payload->customscript->script[]
;   - parameters: payload->customscript->script[nSCRIPT]->parameters.<name>
;     (guard every read with validate())
;   - chart context: patient_source->visits[*] (already entitlement-checked)
;   - acting user: reqinfo->updt_id
;   - output: call ADD_CUSTOM_OUTPUT(cnvtrectojson(yourRec, 4, 1)) — the
;     entry wraps it as {"id": <your id>, "data": {...}}
;   - never write to _Memory_Reply_String yourself; if you execute a
;     Cerner-supplied script, save/restore _Memory_Reply_String around it
;     and use `with replace(...)` to avoid record-name collisions
;******************************************************************************
drop program nh_wf_custom_template:group1 go
create program nh_wf_custom_template:group1

record rEXAMPLE (
    1 message = vc
)

declare cEXAMPLE_PARAM = vc with noconstant("")
if (validate(payload->customscript->script[nSCRIPT]->parameters.example))
    set cEXAMPLE_PARAM = trim(payload->customscript->script[nSCRIPT]->parameters.example, 3)
endif

set rEXAMPLE->message = concat("template ran for user ",
    trim(cnvtstring(reqinfo->updt_id)),
    " with example=", cEXAMPLE_PARAM)

call ADD_CUSTOM_OUTPUT(cnvtrectojson(rEXAMPLE, 4, 1))

end
go
