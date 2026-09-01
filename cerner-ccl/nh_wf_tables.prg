;******************************************************************************
; nh_wf_tables.prg
;
; One-time DDL for the webforms reference store.
;
; Run "C" (create) from a back-end CCL session on the FIRST node of the
; domain. On a multi-node domain (e.g. production), run "O" (oragen) from a
; back-end session on EVERY OTHER node so each node picks up the new table
; reference. Then cycle servers 58, 79, 178 and 179.
;
; Creating a custom table this way is a documented Discern Explorer pattern
; (SELECT INTO TABLE), not a hack.
;
; cust_nh_wf_reference holds form definitions, drafts, and submission
; markers. Bodies larger than 32,000 characters are chunked across rows
; sharing (ref_name, ref_task, parent_entity_id) and ordered by sequence.
;******************************************************************************
drop program nh_wf_tables go
create program nh_wf_tables

prompt
    "Output to File/Printer/MINE" = "MINE"
    , "Mode (C=create, O=oragen on additional nodes)" = "C"
with OUTDEV, MODE

declare cMODE = vc with noconstant(cnvtupper(trim($MODE)))

if (cMODE != "C" and cMODE != "O")
    call echo("nh_wf_tables: pass C to create, or O to refresh the table reference on another node")
    go to end_program
endif

; "O" only needs to re-resolve the table on this node; skip the DDL.
if (cMODE = "O")
    call echo("nh_wf_tables: refreshing cust_nh_wf_reference reference on this node")
    go to oragen_only
endif

rdb create sequence cust_nh_wf_ref_seq end

select into table cust_nh_wf_reference
    ref_id              = type("f8"),
    ref_name            = type("vc40"),
    ref_task            = type("vc40"),
    description         = type("vc100"),
    parent_entity_id    = type("f8"),
    parent_entity_name  = type("vc32"),
    sequence            = type("i4"),
    ref_text            = type("zvc32000"),
    active_ind          = type("i4"),
    create_prsnl_id     = type("f8"),
    create_dt_tm        = type("dq8"),
    updt_id             = type("f8"),
    updt_dt_tm          = type("dq8"),
    beg_effective_dt_tm = type("dq8"),
    end_effective_dt_tm = type("dq8")
from dummyt d
with constraint(ref_id, "primary key", "unique"),
     index(ref_name, ref_task, parent_entity_id, sequence),
     index(updt_dt_tm, updt_id),
     synonym = "CUST_NH_WF_REFERENCE",
     organization = "P"

call echo("cust_nh_wf_reference created")

#oragen_only
call echo("Run this script with O on every other node, then cycle servers 58, 79, 178 and 179")

#end_program
end
go
