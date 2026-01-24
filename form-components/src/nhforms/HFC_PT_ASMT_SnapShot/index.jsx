const {Checkbox, ChoiceGroup} = Fluent



const HFC_PT_ASMT_SnapShot = (props) => {
    const [fd,setFd] = useActiveData()    
    const sd = useSourceData()
    
    const RadioSelectGroup=({optionList,fieldId,codeSystem,section,...props})=>{
        //An extension of the fluent ChoiceGroup that ensures data is sent to the ActiveData properly
                               
        const codesys = props.codeSystem != null? sd.optionLists[`${props.codeSystem}`]:optionList;
        
        var optionList =[]
        
        if (codesys != null){
            codesys.forEach(obj => optionList.push({key:`${obj.key}`,text:`${obj.value??obj.text??null}`,id:`${fieldId}`,codeSystem:`${codeSystem??null}`}));

           /*  for (const [key,value] of Object.entries(codesys)){
                const newitem = {key:`${key}`,text:`${value}`};
                optionlist.push(newitem);
            } */
        }
               
        
        
        return (<>
            {codesys.length>0?
                <ChoiceGroup 
                        styles={props.styles}
                        options={optionList}
                        defaultSelectedKey={fd.field.data[`${fieldId}`]?.code??null}
                        onChange={(opt,choice)=>_onChoiceChange(opt,choice)}
                />
            :
                null
            }
            </>
    
        )
    }

    const handleStateChange = (fieldData) =>{
       fd.setFormData({
       ...fd,
          field: {
        ...fd.field,
        data: fieldData,
      }})
    }

    function _onChoiceChange(opt,choice){
        console.log(opt)
        console.log(choice);;

        var fieldData = opt.target.type!="checkbox"
            ?   
                {
                ...fd.field.data,
                [choice.id]:{
                    "code":`${choice.key}`,
                    "display":`${choice.text}`,
                    "system":`${choice.codeSystem}`
                    }
                }
            :
                {
                ...fd.field.data,
                [opt.target.id]:{
                    "ischecked":choice,
                    }
                }
        
    
        handleStateChange(fieldData);
    }
    
    const checkBoxStyles = {
        checkmark: {
          background: 'white',
          color:'black',
          fontWeight:'bold'
          },
        checkbox:{
          background:'white',
          borderColor:'black'
        }
      };


    const _handlecheckchange = (item,checked) =>{
        const fieldData = {
            ...fd.field.data,
            [item.target.id]:{
                "ischecked":checked,
            }
        }
    
        handleStateChange(fieldData);
        
       /*  setFd({
          ...fd,
          field: {
          ...fd.field,
          data: fieldData,
          }}) */
      }
    
    const _removeAppt=(index)=>{
        const appts = fd.field.data.FollowUpAppts

        appts.appointments.splice(index,1)
        appts.appointmentCount = appts.appointments.length

        const fieldData = {
            ...fd.field.data,
            FollowUpAppts:appts
        }

        handleStateChange(fieldData);
    }

    const _AddAppt=()=>{
        const appts = fd.field.data.FollowUpAppts

        const newAppt={
            "ptSnapFUDate": null,
            "ptSnapFUVisitType": {
                    "code": null,
                    "display": null
                },
            "ptSnapFUVisitModel": {
                "code": null,
                "display": null
            },
        }

        appts.appointments.push(newAppt);

        appts.appointmentCount=appts.length
        
        const fieldData = {
            ...fd.field.data,
            FollowUpAppts:appts
        }

        handleStateChange(fieldData);

    }
    
    const optlist=[
        {key:"BW",text:"Blood work to be completed"},
        {key:"ECG",text:"ECG"},
       /*  {key:"Holter",text:"Holter"},
        {key:"ECHO",text:"ECHO"},
        {key:"MUGA",text:"MUGA"},
        {key:"MIBI",text:"MIBI"}, */
        {key:"Other",text:"Other"}
    ]

    const followUpList=[
        {key:"Nurse",text:"Nurse"},
        {key:"NP",text:"Nurse Practitioner"},
        {key:"MD",text:"Medical Doctor (MD)"}
    ]

    const sortStartDatethenEndDateDesc = (a,b) =>{
        if (!a.startDate&!a.endDate){
            return +1;
        }
        
        if (!b.startDate&!b.endDate){
            return -1;
        }

        if (!a.startDate)
            return +1;
    
        if (!b.startDate){
            return -1;
        }

        if (a.startDate){
            if (!a.endDate){
                return -1;
            }
            else if (a.startDate>b.startDate && b.endDate){
                return -1;
            }
            else if (a.startDate === b.startDate){
                return 0;
            }
            else if (a.startDate<b.startDate && b.endDate){
                return +1;
            }
        }

        if (b.startDate){
            if (!b.endDate){
                return +1;
            }
            else if (b.startDate>a.startDate && a.endDate){
                return +1;
            }
            else if (a.startDate === b.startDate){
                return 0;
            }
            else if (b.startDate<a.startDate && a.endDate){
                return -1;
            }
        }

        /* if (b.startDate){
            if (!b.endDate){
                return +1;
            }
            else{
                return -1;
            }
        } */


        /* if (a.startDate && !a.endDate){
            return b.startDate.localeCompare(a.startDate);
        } */

        
        /* if (!a.startDate && !a.endDate){
            return +1;
        }
                
        if (a.startDate && !a.endDate){
            return -1;
        }

        if (b.startDate > a.startDate && !a.endDate) {
            return +1;
        }

        if (a.startDate > b.startDate && a.endDate) {
            return -1;
        } */
                                     
        /* if (!b.startDate) {
           // Change this values if you want to put `null` values at the end of the array
           return -1;
        } */



         
         /* const StartDatetoTop = b.startDate.localeCompare(a.startDate); */
         /* const EndDateToTop = b.endDate.localeCompare(a.endDate); */

         return 0;
         /* return StartDatetoTop; */
         /* return StartDatetoTop || EndDateToTop; */
    }

    const reminder = 
    `- Restrict your fluid to 1.5-2L per day. This includes the fluid in your food.
                    
- Restrict sodium (salt) intake to 2300mg (or 1tsp) per day
        
- Check your blood pressure, pulse rate, and weight daily. If your weight increases by 4lbs in 2 days or 5lbs in 1 week call the clinic or see a doctor soon to have this assessed.

-Please contact your family doctor or go to the walk in clinic or Emergency room if you notice any worsening of your heart failure symptoms.”`
    
    const tableCellStyle = {display:"table-cell",border:"1px solid #AAAAAA"}
    const tableStyle={display:"table",border:"1px solid darkgrey", borderCollapse:"collapse",width:"100%"}

    const snapdate = new Date(fd?.field?.data?.snapDate?.replace(/-/g, "/"))

    return (
        <>
            <div className="showonprint">
                <NameBlock />
            </div>
            <div style={{width:"100%", textAlign:"center"}}><Title>SNAPSHOT OF YOUR VISIT</Title></div>    
            <br />
            <div className="hideonprint"><SubTitle label="Snapshot of your Visit" /></div>
            <DateTimeSelect 
                fieldId="snapDate"
                defaultValue ={getDateTimeString(new Date())}
                label="Date of Appointment:"
            />
            <TextArea 
                label="Medication Changes:"
                multiline 
                textFieldProps={{autoAdjustHeight:true,resizable:false}}
                fieldId="ptSnapMedChanges"
                
            />
            {/* <Heading label="Long Term Medications" moisModule="LONG TERM MEDS" />

            {sd.patient?.longTermMedications?.length >0 ?
                <Column height={400}>
                    <ListSelection
                        id="longTermMedications"
                        items={sd.patient?.longTermMedications}
                        columns={ltRXcols}
                        selectionType="none"
                        detailsListProps={{styles:{root: {maxHeight: "400px", overflowX:"hidden",overflowY:"auto"}}}}
                        listCompare ={sortStartDatethenEndDateDesc}
                    />
                </Column>
            :
                <span>No long term medications have been recorded for this patient.</span>
            } */}

            <Heading label="Test:">
            <div style={{width:"100%",display:"flex",flexDirection:"Column"}}>
                {optlist.map((obj)=>{
                    
                    return(
                        <>
                            <div style={{display:"flex",flexDirection:"row"}}>
                                <div style={{width:"25%"}}>
                                    <SimpleCodeChecklist 
                                        optionList={[
                                            {key:`${obj.key}`,text:`${obj.text}`}
                                        ]}
                                        fieldId={`ptSnap${obj.key}`}
                                        selectionType="multiple"
                                        optionProps={{styles:{checkmark:{background:"white",color:"black",fontWeight:"bolder"},checkbox:{background:"white",borderColor:"black"}}}}
                                        
                                    />
                                </div>
                                <div style={{width:"75%"}}>
                                    <TextArea 
                                        multiline 
                                        textFieldProps={{autoAdjustHeight:true,resizable:false}}
                                        fieldId={`ptSnap${obj.key}Notes`} 
                                    />
                                </div>
                            </div>

                        </>
                    
                    )
                    }
                )}         
            </div>
            </Heading>
            
            <SimpleCodeChecklist
                fieldId="ptSnapFUApptNeeded"
                selectionType="single"
                codeSystem="MOIS-YESNO"
                label="Follow-up Appointments needed"
                optionSize="tiny"
                conditionalCodes={["Y","N"]}

            >

            
            {fd.field.data.ptSnapFUApptNeeded?.code ==="Y"?
            
                <Heading label="Follow-up appointments:" labelStyles={{style:{fontWeight:"600"}}}>
                    
                    {fd?.uiState?.sections?.[0]?.isComplete === true?
                        null
                    :
                        <DefaultButton text="Add Appointment" iconProps={{iconName:'Add'}} onClick={_AddAppt} className="hideonprint" disabled={sd.webform?.recordState ==='SIGNED'} styles={{root:{width:"fit-content",pageBreakInside:"avoid"}}}/>
                    }

                    <div className={`${fd.field.data.FollowUpAppts.appointments.length === 0?"showonprint":""}`} style={{display:"none"}}>
                        <span>No follow-up appointments scheduled</span>
                    </div>

                    <div style={tableStyle} className={`${fd.field.data.FollowUpAppts.appointments.length === 0?"hideonprint":""}`}>
                        <div style={{display:"table-header-group", pageBreakInside:"avoid"}}>
                            <div style={{display:"table-row", pageBreakInside:"avoid",backgroundColor:"lightgrey"}}>
                                <div style={{display:"table-cell",width:"25%",textAlign:"center",fontSize:"16px",fontWeight:"bold",verticalAlign:"middle"}}>Date</div>
                                <div style={{display:"table-cell",width:"50%",textAlign:"center",fontSize:"16px",fontWeight:"bold"}}>Visit Type<br/>(Education, RN, NP, MD)</div>
                                <div style={{display:"table-cell",textAlign:"center",fontSize:"16px",fontWeight:"bold",verticalAlign:"middle"}}>Visit Mode</div>
                                <div style={{display:"table-cell",width:"10%",textAlign:"center",fontSize:"16px",fontWeight:"bold"}} className="hideonprint"></div>
                            </div>
                        </div>
                        <div style={{display:"table-row-group", pageBreakInside:"avoid"}}>
                            {fd.field.data.FollowUpAppts.appointments.length === 0?
                                <div style={{display:"table-row", pageBreakInside:"avoid"}}>
                                No follow-up appointments scheduled
                                </div>
                            :   
                            
                            fd.field.data.FollowUpAppts.appointments.map((obj,index)=>{
                                console.log(fd.field.data.FollowUpAppts.appointments[index]);
                                return( 
                                <div style={{display:"table-row", pageBreakInside:"avoid"}}>
                                    <div style={{maxWidth:"20%",...tableCellStyle}}>
                                        <div className="showonprint showapptonprint"> 
                                            {fd.field.data.FollowUpAppts.appointments[index].ptSnapFUDate?`${getDateString(new Date(fd.field.data.FollowUpAppts.appointments[index].ptSnapFUDate),"-")} ${getTimeString(new Date(fd.field.data.FollowUpAppts.appointments[index].ptSnapFUDate))}`:null }
                                        </div>
                                        <div style={{width:"100%"}} className="hideonprint">
                                            <DateTimeSelect 
                                                fieldId="ptSnapFUDate" 
                                                size={{width:"100%"}}
                                                datePickerProps={{minDate: new Date(snapdate)}}
                                                section={{activeSelector:(fd)=>fd.field.data.FollowUpAppts.appointments[index]}}
                                            />
                                        </div>
                                        {/* <DateSelect 
                                            fieldId="ptSnapFUDate" 
                                            size={{width:"100%"}}
                                            datePickerProps={{minDate: new Date(snapdate)}}
                                            section={{activeSelector:(fd)=>fd.field.data.FollowUpAppts.appointments[index]}}
                                        /> */}
                                    </div>
                                    <div style={{maxWidth:"20%",...tableCellStyle}}>
                                        <div className="showonprint showapptonprint">
                                            {fd.field.data.FollowUpAppts.appointments[index].ptSnapFUVisitType.display}                                        
                                        </div>
                                        <div style={{width:"100%"}} className="hideonprint">
                                            <SimpleCodeSelect 
                                                fieldId="ptSnapFUVisitType" 
                                                size={{width:"100%"}}
                                                optionList={[
                                                    {key:"HFE",text:"Heart Failure Education"},
                                                    {key:"RN",text:"RN"},
                                                    {key:"NP",text:"NP"},
                                                    {key:"MD",text:"MD"},
                                                    {key:"blend",text:"Blended Heart Failure/Cardiac Risk Reduction Education"}
                                                ]}
                                                showOtherOption
                                                size={{width:"100%"}}
                                                section={{activeSelector:(fd)=>fd.field.data.FollowUpAppts.appointments[index]}}
                                            />
                                        </div>
                                    </div>
                                    <div style={{...tableCellStyle, textAlign:"center"}}>
                                        <div style={{maxWidth:"250px"}}>
                                            <div className="showonprint showapptonprint">
                                                {fd.field.data.FollowUpAppts.appointments[index].ptSnapFUVisitModel.display}
                                            </div>
                                            <div style={{width:"100%"}} className="hideonprint">
                                                <SimpleCodeSelect 
                                                    fieldId="ptSnapFUVisitModel"
                                                    optionList={[
                                                        {key:"Televisit",text:"Televisit"},
                                                        {key:"IP",text:"In Person"}
                                                    ]}
                                                    size={{width:"100%"}}
                                                    optionProps={{styles:{root:{padding:"0px 10px"}}}}
                                                    section={{activeSelector:(fd)=>fd.field.data.FollowUpAppts.appointments[index]}}
                                                />
                                            </div>
                                        </div>
                                        
                                    </div>
                                    <div style={{...tableCellStyle, minWidth:"100px",textAlign:"center"}} className="hideonprint">
                                        {fd?.uiState?.sections?.[0]?.isComplete === true?
                                            null
                                            :
                                            <DefaultButton text="Remove" onClick={()=>_removeAppt(index)} className="hideonprint" disabled={sd.webform?.recordState ==='SIGNED'} />
                                        }
                                    </div>
                                </div>
                                )}
                            )}
                        </div>
                    </div>
                           
                    <TextArea 
                        label="Reminders:"
                        labelPostion="top"
                        multiline
                        defaultValue={reminder}
                        textFieldProps={{autoAdjustHeight:true,resizable:false}}
                        fieldId="ptSnapFUReminderNotes"
                    />
                </Heading>
            :
                fd.field.data.ptSnapFUApptNeeded?.code === "N"?
                <Heading label="Program Complete. No further follow-up needs to be booked." labelStyles={{style:{fontWeight:"600"}}} />:null
                }
            </SimpleCodeChecklist>
        </>
    )
}



/* const RadioSelectGroup=({optionList,fieldId,codeSystem,section,...props})=>{
    //An extension of the fluent ChoiceGroup that ensures data is sent to the ActiveData properly
    const [fd,setFd] = useActiveData()
    const sd = useSourceData()
            
    const codesys = props.codeSystem != null? sd.optionLists[`${props.codeSystem}`]:optionList;
    
    var optionlist = [];
    
    if (codesys != null){
        for (const [key,value] of Object.entries(codesys)){
            const newitem = {key:`${key}`,text:`${value}`};
        }
    }
           
    return (<>
        {optionlist.length>0?
            <ChoiceGroup 
                    styles={props.styles}
                    options={optionlist}
                    defaultSelectedKey={fd.field.data[`${fieldId}`]?.code??null}
                    onChange={(opt,choice)=>_onChoiceChange(opt,choice,fieldId,props.codeSystem)}
            />
        :
            null
        }
        </>

    )
} */

/* function _onChoiceChange(opt,choice,fieldId,cs){
    const[fd] = useActiveData();
    
    console.dir(choice);

    const fieldData = {
        ...fd.field.data,
        [fieldId]:{
            "code":`${choice.key}`,
            "display":`${choice.text}`,
            "system":`${cs}`
        }
    }

    props.handleStateChange(fieldData);

} */

/* const handleStateChange = (fieldData) =>{
   const [fd]
   
    fd.setFormData({
      ...fd,
      field: {
      ...fd.field,
      data: fieldData,
      }})
  } */

