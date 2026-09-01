;******************************************************************************
; nh_wf_tables.prg
;
; One-time DDL for the webforms reference store. Run once per domain as a
; DBA, then cycle the application servers before the store is used
; (!! SITE REVIEW: confirm which servers with the DBA — commonly the script
; and query servers, e.g. 58/79/178/179).
;
; cust_nh_wf_reference holds form definitions, drafts, and submission
; markers. Bodies larger than 32,000 characters are chunked across rows
; sharing (ref_name, ref_task, parent_entity_id) and ordered by sequence.
;******************************************************************************
drop program nh_wf_tables go
create program nh_wf_tables

prompt
    "Output to File/Printer/MINE" = "MINE"
    , "Mode (C=create)" = "C"
with OUTDEV, MODE

if (cnvtupper(trim($MODE)) != "C")
    call echo("nh_wf_tables: pass C to create the sequence and table")
    go to end_program
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

call echo("cust_nh_wf_reference created; cycle application servers before use")

#end_program
end
go
