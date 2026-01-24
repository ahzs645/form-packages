

const HFC_PT_ASMT_PatientAssessment = () => {

    const [phq9vis,setphq9vis] = React.useState(false)
    const [fd,setFd] = useActiveData();
    const sd = useSourceData();
    const [obsInFocus,setObsInFocus]=React.useState([]);

    /* const items = sourceItems?.filter(filterPred)?.map(finalSourceMap)?.sort(listCompare) ?? [] */
    const histcols = [
        {
            id:"observationId",
            type:"key"
        },
        {
            title:"Collected Date",
            id:"collectedDateTime",
            type:"string",
            onColumnMap:(item)=>item.collectedDateTime.replace("T"," "),
            size:"small"
        },
        {
            title:"Code",
            id:"observationCode",
            type:"string",
            size:"tiny"
            
        },
        {
            title:"Test name",
            id:"description",
            type:"string",
            size:"medium"
            
        },
        {
            title:"Value",
            id:"vwunits",
            type:"string",
            onColumnMap:(item)=>`${item.value??'-'} ${item.units}`,
            size:"tiny"
        },
    
    ]

    const finalSourceMap = MoisFunction.mapSourceToActive(histcols)

    const _onupdate = (event,field) => {
        const inputValue = event.target.value;
        
        let formattedValue;
        let parts;
        
        if (field.includes("BP")){
            formattedValue = inputValue.replace(/[^0-9/]/g, '');
            parts = formattedValue.split('/').length;
        } else {
            formattedValue = inputValue.replace(/[^0-9.]/g, '');
            parts = formattedValue.split('.').length;
        }
    
        if (parts<=2) {
            
            const fieldData = {
                ...fd.field.data,
                [`${field}`]:`${formattedValue}`
            }

            handleChange(fieldData);
        }
    };
    
    
    
   /*  const _onupdate = (con,field) =>{
        const curvalue = con.target.value
        const newval =con.nativeEvent.data


        


        
        if (!isNaN(curvalue) || ((newval ==="." && !field.includes("BP"))&&!curvalue.includes("."))||((field.includes("BP") && newval==="/") &&!curvalue.includes("/"))) {
            


                const fieldData = {
                    ...fd.field.data,
                    [`${field}`]:`${curvalue}`
                }

                handleChange(fieldData);
            
        }
    } */

    const handleChange = (fieldData) =>{
       /* props.handleStateChange(fieldData); */
       setFd({
        ...fd,
        field: {
        ...fd.field,
        data: fieldData,
        }})
    }
    
    


    /* useOnLoad((sd,fd)=>{
        const fieldData = {
            ...fd.field.data,
            PHQ9Questionnaire:{...PHQ9Quest}
        }

        fd.field.data.PHQ9Questionnaire?
            null
        :
           handleChange(fieldData); 
    })
 */
    

    const PHQ9answers ={
        "0":"Not at all",
        "1":"Several Days",
        "2":"More than haf the days",
        "3":"Nearly Every Day"
    }
    



    const toggleSelect=(qindex,value) => {

        if (fd?.uiState?.sections?.[0]?.isComplete === false) {
            const questionairre = fd.field.data.PHQ9Questionnaire;

            let TotalVal9 = null;
            let TotalVal2 = null
            /* console.log(`mapping something for ${qindex} with value ${value}`); */

            questionairre.Questions[qindex].selectedAnswer.value = value;
            questionairre.Questions[qindex].selectedAnswer.description = value != null?PHQ9answers[`${qindex}`]:null;
            questionairre.Questions[qindex].selectedAnswer.fieldId= value != null?`PHQ9Q${qindex+1}${value}`:null;

            const checkarr9 = questionairre.Questions.filter(obj=> obj.selectedAnswer.value === null);
            const checkarr2 = questionairre.Questions.filter(obj=> obj.questionIndex <= 2 && obj.selectedAnswer.value === null)

            if (checkarr2.length === 0){

                TotalVal2 = 0;

                questionairre.Questions.filter(obj=>obj.questionIndex <= 2).forEach(obj => TotalVal2 += parseInt(obj.selectedAnswer.value))
                
            }
                    
            if (checkarr9.length === 0 && TotalVal2 >= 3){

                TotalVal9 = 0;

                questionairre.Questions.forEach(obj => TotalVal9 += parseInt(obj.selectedAnswer.value))
                
            }
                    

            questionairre["PHQ9Score"]=TotalVal9;
            questionairre["PHQ2Score"]=TotalVal2;

            const fieldData = {
                ...fd.field.data,
                PHQ9Questionnaire:{...questionairre}
            }

            handleChange(fieldData)
        }
    }

    const symptomsTable =[
        {display:"Fatigue",loincCode:"28100-6", code:"21250",fieldId:"ptAsFatigue"},
        {display:"SOB/Dyspnea",loincCode:"45705-1", code:"45345",fieldId:"ptAsSOB"},
        {display:"PND",loincCode:null, code:"A12312",fieldId:"ptAsPND"},
        {display:"Orthopnea",loincCode:"82951-5", code:"X0104",fieldId:"ptAsOrthopnea"},
        {display:"Palpitations",loincCode:null, code:"A12314",fieldId:"ptAsPalpitations"},
        {display:"Light Headedness",loincCode:null, code:"A12315",fieldId:"ptAsLightHeadedness"},
        /* {display:"GI Complaints",loincCode:null, code:"X0105",fieldId:"ptAsGIComplaints"},
        {display:"Limits to ADL's",loincCode:null, code:"X0106",fieldId:"ptAsADLLimits"}, */
        {display:"Chest Pain/Angina",loincCode:"58529-3", code:"58250",fieldId:"ptAsChestPainAngina"},
    ]
    
    const swellingTable=[
        {display:"Legs",loincCode:"",code:"A12318",fieldId:"ptAsLegSwelling"},
        {display:"Abdomen",loincCode:"",code:"X0107",fieldId:"ptAsAbdomenSwelling"},
    ]
    
    const latestCollectedFirst = (a, b) => {
        const acol = a.collectedDateTime ? a.collectedDateTime : "2100-01-01"
        const bcol = b.collectedDateTime ? b.collectedDateTime : "2100-01-01"
        return -asciiCompare(acol, bcol)
      }
      
    const asciiCompare = (a, b) => (a > b ? 1 : a < b ? -1 : 0)
    
    return (
        <>
            <div className="showonprint">
                <NameBlock />
            </div>
            <Title>PATIENT ASSESSMENT</Title>
            <SubTitle label="Medication Reconciliation" />
            <SimpleCodeChecklist
                label="Medication Reconciliation Completed?"
                fieldId = "ptAsMedRec"
                codeSystem="MOIS-YESNO"
                labelPosition="left"
                optionSize="tiny"
                moisModule="LONG TERM MEDS"
            />
            <TextArea 
                fieldId="ptSumMedNotes"
                multiline
                textFieldProps={{autoAdjustHeight:true,resizable:false}}
                defaultValue="Completed with client’s Pharmanet med list and client’s medications brought into clinic"
            />

            <SubTitle label ="History: Since Last Visit (Check all that Apply)" />
            <SimpleCodeChecklist
                label = "Doctor visits outside of clinic?"
                fieldId="ptAsDocVisits"
                codeSystem="MOIS-YESNO"
                labelPosition="left"
                optionSize="tiny"
                conditionalCodes={["Y"]}
                >
                <TextArea
                    label = "# of visits"
                    fieldId="ptAsDocVisitsCount"
                    labelPosition="left"
                    /* labelProps={{style:{minWidth:"0px"}}} */
                    size="tiny"
                />
                <TextArea
                    label="Reason(s)"
                    labelPosition="left"
                    fieldId="ptAsDocVisitsReason"
                    multiline
                    /* labelProps={{style:{minWidth:"0px"}}} */
                    textFieldProps={{autoAdjustHeight:true,resizable:false}}
                />
            </SimpleCodeChecklist>
            <SimpleCodeChecklist
                label = "Emergency Room (ER) visits?"
                fieldId="ptAsERVisits"
                codeSystem="MOIS-YESNO"
                labelPosition="left"
                optionSize="tiny"
                conditionalCodes={["Y"]}
            >
                <TextArea
                    label = "# of visits"
                    fieldId="ptAsERVisitsCount"
                    labelPosition="left"
                    /* labelProps={{style:{minWidth:"0px"}}} */
                    size="tiny"
                />
                <TextArea
                    label="Reason(s)"
                    labelPosition="left"
                    fieldId="ptAsERVisitsReason"
                    multiline
                    /* labelProps={{style:{minWidth:"0px"}}} */
                    textFieldProps={{autoAdjustHeight:true,resizable:false}}
                />
            </SimpleCodeChecklist>
            
            <SimpleCodeChecklist
                label = "Hospitalizations?"
                fieldId="ptAsHospitalVisits"
                codeSystem="MOIS-YESNO"
                labelPosition="left"
                optionSize="tiny"
                conditionalCodes={["Y"]}
            >
                <TextArea
                    label ="# days in Hospital"
                    labelPosition="left"
                    fieldId="ptAsHospitalVisitsCount"
                    /* labelProps={{style:{minWidth:"0px"}}} */
                    size="tiny" 
                />
                <TextArea
                    label="Reason(s)"
                    labelPosition="left"
                    fieldId="ptAsHospitalVisitsReason"
                    multiline
                    /* labelProps={{style:{minWidth:"0px"}}} */
                    textFieldProps={{autoAdjustHeight:true,resizable:false}}
                />
            </SimpleCodeChecklist>
           
            <SubTitle label = "Cardiac Device"/>
            <SimpleCodeChecklist 
                    label="Type of Device"
                    fieldId="ptSumCDNotesChecklist"
                    optionList={[
                        {key:"None",text:"None"},
                        {key:"ICD",text:"ICD"},
                        {key:"CRT-D",text:"CRT-D"},
                        {key:"CRT-P",text:"CRT-P"},
                        {key:"Pacemaker",text:"Pacemaker"}
                    ]}
                    optionSize="small"
                />
            <SimpleCodeChecklist
                label="Shocks"
                labelPosition="left"
                codeSystem="MOIS-YESNO"
                fieldId="ptAsShocks" 
                optionSize="tiny"
                conditionalCodes={["Y"]}>
                    <TextArea
                        label = "# of Shocks?"
                        labelPosition="left"
                        labelProps={{style:{minWidth:"0px"}}}
                        fieldId="ptAsShocksCount"/>
            </SimpleCodeChecklist>
            
            <Heading label="Physical Exam" labelStyles={{style:{fontWeight:"600",borderBottom:"1px solid black", width:"100%"}}}>
                <div className="addapt"><Heading text="If you need to access measures in MOIS you can click here" moisModule="MEASUREMENTS" /></div>
                <TextArea
                    label="Heart Rate (/min)"
                    /* labelProps={{style:{minWidth:"0px"}}} */
                    fieldId="ptAsHR"
                    size="small"
                    textFieldProps={{suffix:"bpm"}}
                    onChange={(e)=>_onupdate(e,"ptAsHR")}
                />

                <TextArea
                    label="Home Heart Rate (/min)"
                    /* labelProps={{style:{minWidth:"0px"}}} */
                    fieldId="ptAsHomeHR"
                    size="small"
                    textFieldProps={{suffix:"bpm"}}
                    onChange={(e)=>_onupdate(e,"ptAsHomeHR")}
                />
                
                <TextArea
                    label="O2 SAT (%)"
                    /* labelProps={{style:{minWidth:"0px"}}} */
                    fieldId="ptAsO2"
                    size="small"
                    customStyles ={{style:{pageBreakInside:"avoid"}}}
                    textFieldProps={{suffix:"%"}}
                    onChange={(e)=>_onupdate(e,"ptAsO2")}
                />
                
                <TextArea
                    label="Jugular Veinous Pulse (JVP) (Cm):"
                    /* labelProps={{style:{minWidth:"0px"}}} */
                    fieldId="ptAsJVP"
                    size="small"
                    customStyles ={{style:{pageBreakInside:"avoid"}}}
                    textFieldProps={{suffix:"cm"}}
                    onChange={(e)=>_onupdate(e,"ptAsJVP")}
                />
               
                <TextArea
                    label="Waist (Cm):"
                    /* labelProps={{style:{minWidth:"0px"}}} */
                    fieldId="ptAsWaist"
                    size="small"
                    textFieldProps={{suffix:"cm"}}
                    onChange={(e)=>_onupdate(e,"ptAsWaist")}
                />
            {/* </Heading> */}
          {/*   <div style={{width:"100%",borderBottom:"1px solid black"}}>
                <Heading label="Vital Signs" labelStyles={{style:{fontWeight:"600"}}} moisModule="MEASUREMENTS" />
            </div> */}
{/*             <Heading label="Vital Signs" labelStyles={{style:{fontWeight:"600",borderBottom:"1px solid black", width:"100%"}}} moisModule="MEASUREMENTS" /> */}
            {/* <Heading> */}
                {/* <Mois.ObservationPanel.observations 
                    filterPred={Boolean(obsInFocus)?(item)=>item.observationCode === obsInFocus:()=>true} 
                    listCompare={latestCollectedFirst} 
                    detailsListProps={{listProps:{renderCount:Boolean(obsInFocus)?5:0}}} 
                    label="Past 5 Observations:"
                    
                /> */}
                <div className="hideonprint">
                    {obsInFocus.length>0?
                    
                        <ListSelection 
                            columns={histcols}
                            /* id="observations" */
                            /* items={sd.patient.observations} */
                            items={sd.patient.observations.filter(item=>obsInFocus.length===1? item.observationCode === obsInFocus[0] && item.comment !== "As taken at home": item.observationCode === obsInFocus[0] && item.comment === obsInFocus[1]).map(finalSourceMap)}
                            //filterPred={Boolean(obsInFocus)?(item)=>item.observationCode === obsInFocus:()=>true}
                            listCompare={latestCollectedFirst} 
                            detailsListProps={{listProps:{renderCount:obsInFocus.length > 0 ?5:0}}}
                            labelProps={{style:{maxWidth:"100%"}}}
                            label={`Past 5 Observations of selected ${obsInFocus.length ===1? 'CLINIC':'HOME'} measure:`}
                        
                        />
                    :
                        <span style={{fontWeight:"bold"}}>Please select a Weight or BP measure from below to see history</span>
                    }
                    {/* Filter predicate is not regenerating what items to filter to. Will check with Brian about this, but may need to do custom ListSelection where items used are passed back from a function. argh */}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",borderBottom:"1px solid lightgray", borderTop:"1px solid lightgray",marginTop:"20px"}}>
                    <div style={{maxWidth:"40%",width:"40%"}}>
                        <div className="hideonprint">        
                            <TextArea
                                label ="Weight (Kg):"
                                fieldId="ptAsWeight"
                                labelProps={{style:{minWidth:"80px"}}}
                                textFieldProps={{suffix:"kg",onFocus:()=>setObsInFocus(["22732"]), onBlur:()=>setObsInFocus([])}}
                                onChange={(e)=>_onupdate(e,"ptAsWeight")}
                                
                            />
                            <TextArea
                                label ="BP Sitting:"
                                fieldId="ptAsBPSitting"
                                labelProps={{style:{minWidth:"80px"}}}
                                textFieldProps={{onFocus:()=>setObsInFocus(["61826"]), onBlur:()=>setObsInFocus([])}}
                                onChange={(e)=>_onupdate(e,"ptAsBPSitting")}
                            />
                            <TextArea
                                label ="BP Lying:"
                                fieldId="ptAsBPLying"
                                labelProps={{style:{minWidth:"80px"}}}
                                textFieldProps={{onFocus:()=>setObsInFocus(["61828"]), onBlur:()=>setObsInFocus([])}}
                                onChange={(e)=>_onupdate(e,"ptAsBPLying")}
                            />
                            <TextArea
                                label ="BP Standing:"
                                fieldId="ptAsBPStanding"
                                labelProps={{style:{minWidth:"80px"}}}
                                textFieldProps={{onFocus:()=>setObsInFocus(["61827"]), onBlur:()=>setObsInFocus([])}}
                                onChange={(e)=>_onupdate(e,"ptAsBPStanding")}
                            /> 
                        </div>
                        {/* <div className="showonprint">        
                            <TextArea
                                customStyles={{fieldGroup:{maxWidth:"40%"}}}
                                label ="Weight (Kg):"
                                fieldId="ptAsWeight"
                                labelProps={{style:{minWidth:"80px"}}}
                                textFieldProps={{suffix:"kg"}}
                            />
                            <TextArea
                                customStyles={{fieldGroup:{maxWidth:"40%"}}}
                                label ="BP Sitting:"
                                fieldId="ptAsBPSitting"
                                labelProps={{style:{minWidth:"80px"}}}
                            />
                            <TextArea
                                customStyles={{fieldGroup:{maxWidth:"40%"}}}
                                label ="BP Lying:"
                                fieldId="ptAsBPLying"
                                labelProps={{style:{minWidth:"80px"}}}
                            />
                            <TextArea
                                customStyles={{fieldGroup:{maxWidth:"40%"}}}
                                label ="BP Standing:"
                                fieldId="ptAsBPStanding"
                                labelProps={{style:{minWidth:"80px"}}}
                            /> 
                        </div> */}
                    </div>
                    <div style={{maxWidth:"40%",width:"40%"}}>
                        <div className="hideonprint">
                            <TextArea
                                label ="Home Weight (Kg):"
                                fieldId="ptAsHomeWeight"
                                labelProps={{style:{minWidth:"123px"}}}
                                textFieldProps={{suffix:"kg",onFocus:()=>setObsInFocus(["22732","As taken at home"]), onBlur:()=>setObsInFocus([])}}
                                onChange={(e)=>_onupdate(e,"ptAsHomeWeight")}
                            />
                            <TextArea
                                label ="Home BP Sitting:"
                                fieldId="ptAsHomeBPSitting"
                                labelProps={{style:{minWidth:"123px"}}}
                                textFieldProps={{onFocus:()=>setObsInFocus(["61826","As taken at home"]), onBlur:()=>setObsInFocus([])}}
                                onChange={(e)=>_onupdate(e,"ptAsHomeBPSitting")}
                                
                            />
                            <TextArea
                                label ="Home BP Lying:"
                                fieldId="ptAsHomeBPLying"
                                labelProps={{style:{minWidth:"123px"}}}
                                textFieldProps={{onFocus:()=>setObsInFocus(["61828","As taken at home"]), onBlur:()=>setObsInFocus([])}}
                                onChange={(e)=>_onupdate(e,"ptAsHomeBPLying")}

                            />
                            <TextArea
                                label ="Home BP Standing:"
                                fieldId="ptAsHomeBPStanding"
                                labelProps={{style:{minWidth:"123px"}}}
                                textFieldProps={{onFocus:()=>setObsInFocus(["61827","As taken at home"]), onBlur:()=>setObsInFocus([])}}
                                onChange={(e)=>_onupdate(e,"ptAsHomeBPStanding")}
                            />
                        </div>
                        {/* <div className="showonprint">
                            <TextArea
                                customStyles={{fieldGroup:{maxWidth:"40%"}}}
                                label ="Home Weight (Kg):"
                                fieldId="ptAsHomeWeight"
                                labelProps={{style:{minWidth:"123px"}}}
                                textFieldProps={{suffix:"kg"}}
                            />
                            <TextArea
                                customStyles={{fieldGroup:{maxWidth:"40%"}}}
                                label ="Home BP Sitting:"
                                fieldId="ptAsHomeBPSitting"
                                labelProps={{style:{minWidth:"123px"}}}
                            />
                            <TextArea
                                customStyles={{fieldGroup:{maxWidth:"40%"}}}
                                label ="Home BP Lying:"
                                fieldId="ptAsHomeBPLying"
                                labelProps={{style:{minWidth:"123px"}}}
                            />
                            <TextArea
                                customStyles={{fieldGroup:{maxWidth:"40%"}}}
                                label ="Home BP Standing:"
                                fieldId="ptAsHomeBPStanding"
                                labelProps={{style:{minWidth:"123px"}}}
                            />
                        </div> */}
                    </div>
                </div>
                <TextArea
                    label="Lung Sounds:"
                    fieldId="ptAsLungs"
                    /* labelProps={{style:{minWidth:"0px"}}}                */
                />
                
                <div style={{display:"flex",flexDirection:"row",width:"100%"}}>
                <TextArea
                    label = "Daily Fluid Intake (best estimate):"
                    /* labelProps={{style:{minWidth:"0px"}}} */ 
                    fieldId="ptAsFluidIntake"
                    size="small"
                    onChange={(e)=>_onupdate(e,"ptAsFluidIntake")}
                />
                <SimpleCodeSelect
                    fieldId="ptAsFluidIntakeVol"
                    size="100px"
                    optionList={[
                        {key:"L",text:"Litres"},
                        {key:"mL",text:"Mililitres"},
                    ]}
                />
                </div>
                
                <SimpleCodeChecklist 
                    label="Drinks Alcohol?"
                    codeSystem ="MOIS-YESNO"
                    fieldId="ptAsAlcQuest"
                    conditionalCodes={["Y"]}
                    optionSize="tiny"
                >
                    <table>
                        <tr>
                            <td style={{fontSize: "14px", fontWeight: "600", width:"20%", minWidth:"200px"}}># of alcoholic drinks?</td>
                            <td style={{width:"5%"}}><TextArea fieldId="ptAsAlcoholCount" size="small" labelProps={{style:{minWidth:"0px"}}}/></td>
                            <td style={{width:"10%",textAlign:"center"}}>Per</td>
                            <td style={{width:"25%"}}><SimpleCodeSelect optionList={[
                                {key:"day",text:"Day"},
                                {key:"week",text:"Week"},
                                ]}
                                showOtherOption
                                fieldId="ptAsAlcoholFreq"
                            /></td>
                        </tr>
                    </table>
                </SimpleCodeChecklist>

                <SimpleCodeChecklist 
                    label="Smokes Cigarettes?"
                    codeSystem ="MOIS-YESNO"
                    fieldId="ptAsCigQuest"
                    conditionalCodes={["Y"]}
                    optionSize="tiny"
                >
                    <table>
                        <tr>
                            <td style={{fontSize: "14px", fontWeight: "600", width:"20%", minWidth:"210px"}}># of cigarettes smoked?</td>
                            <td style={{width:"5%"}}><TextArea fieldId="ptAsCigCount" size="tiny" labelProps={{style:{minWidth:"0px"}}}/></td>
                            <td style={{width:"5%", maxWidth:"100px"}}><SimpleCodeSelect optionList={[
                                {key:"single",text:"Individual"},
                                {key:"pack20",text:"Pack (20)"},
                                {key:"pack25",text:"Pack (25)"},
                                ]}
                                fieldId="ptAsCigType"
                                size={{width:"100px"}}
                                /></td>
                            <td style={{width:"10%", textAlign:"center"}}>Per</td>
                            <td style={{width:"25%"}}><SimpleCodeSelect optionList={[
                                {key:"day",text:"Day"},
                                {key:"week",text:"Week"},
                                ]}
                                showOtherOption
                                fieldId="ptAsCigFreq"
                            /></td>
                        </tr>
                    </table>
                </SimpleCodeChecklist>
               
                <SimpleCodeChecklist 
                    label="Smokes Marijuana?"
                    codeSystem ="MOIS-YESNO"
                    fieldId="ptAsMJQuest"
                    conditionalCodes={["Y"]}
                    optionSize="tiny"
                >
                    <TextArea 
                        fieldId="ptAsMJQuestComments"
                        label="Comments:"
                        multiline
                        textFieldProps={{autoAdjustHeight:true,resizable:false}}
                    />
                </SimpleCodeChecklist>

                <SimpleCodeChecklist 
                    label="Illicit Drug Use?"
                    codeSystem ="MOIS-YESNO"
                    fieldId="ptAsIDQuest"
                    conditionalCodes={["Y"]}
                    optionSize="tiny"
                >
                    <TextArea 
                        fieldId="ptAsIDQuestComments"
                        label="Comments:"
                        multiline
                        textFieldProps={{autoAdjustHeight:true,resizable:false}}
                    />
                </SimpleCodeChecklist>


                <TextArea 
                    label="Additional Physical Exam Comments:"
                    labelPosition="top"
                    multiline
                    textFieldProps={{autoAdjustHeight:true,resizable:false}}
                    fieldId="ptASAdditonalPhysicalExamNotes"
                />
            </Heading> 

            <SubTitle label="Symptoms" />
            <table style={{width:"100%",border:"1px solid darkgrey", borderCollapse:"collapse",pageBreakInside:"avoid" }}>
                <thead style={border}>
                    <tr>
                        <th style={{textAlign:"center",width:"20%"}}>SYMPTOMS</th>
                        <th style={{textAlign:"center",width:"20%"}}>STATUS</th>
                        <th style={{textAlign:"center"}}>NOTES</th>
                    </tr>
                </thead>
                <tbody>
                    {symptomsTable.map((obs)=>{
                              return (
                                <TableMeasureRow label={obs.display} testId={obs.code} fieldId={obs.fieldId}/>
                              )
                            })
                    }
                
                    <tr style={{borderTop:"1px solid darkgrey"}}>
                        <td colSpan={3}>
                            <div style={{width:"100%",display:"flex", flexDirection:"row"}}>
                            <div style={{width:"40%", paddingLeft:"5px"}}>
                                <TextArea 
                                    label="# of pillows under the head normally:"
                                    labelPosition="left"
                                    labelProps={{style:{minWidth:"0px"}}}
                                    size="tiny"
                                    fieldId="ptAsNormPillowCount" 
                                />
                            </div>
                            <div style={{display:"table-cell", width:"30%", paddingLeft:"20px"}}>
                                <TextArea 
                                    label="Current:"
                                    labelPosition="left"
                                    labelProps={{style:{minWidth:"0px"}}} 
                                    fieldId="ptAsCurrPillowCount" 
                                    size="tiny"
                                />
                            </div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={3}>
                            <TextArea
                                fieldId="ptAsNormPillowCountNotes"
                                multiline
                                textFieldProps={{autoAdjustHeight:true,resizable:false,}}
                                placeholder="Notes"
                            />
                        </td>
                    </tr>
                </tbody>


            </table>
            
            <SubTitle label="Swelling"/>
            <table style={{width:"100%",border:"1px solid darkgrey", borderCollapse:"collapse",pageBreakInside:"avoid" }}>
                <thead style={border}>
                    <tr>
                        <th style={{textAlign:"center",width:"20%"}}>SWELLING</th>
                        <th style={{textAlign:"center",width:"20%"}}>STATUS</th>
                        <th style={{textAlign:"center"}}>NOTES</th>
                    </tr>
                </thead>
                <tbody>
                    {swellingTable.map((obs)=>{
                              return (
                                <TableMeasureRow label={obs.display} testId={obs.code} fieldId={obs.fieldId}/>
                              )
                            })
                    }
                    <tr style={{borderTop:"1px solid darkgrey"}}>
                        <td style={{paddingLeft:"5px"}}>
                            Extra Diuretics
                        </td>
                        <td>
                            <SimpleCodeChecklist
                                codeSystem="MOIS-YESNO"
                                fieldId="ptAsExtraDiuretics"
                                autoHotKey
                                size="small"
                                optionSize=""
                            />
                        </td>
                        <td>
                            <TextArea
                                multiline
                                fieldId="ptAsExtraDiureticsNotes"
                                textFieldProps={{autoAdjustHeight:true,resizable:false,}}
                                labelProps={{style:{minWidth:"0px"}}}
                                placeholder="Notes"
                            />
                        </td>
                    </tr>
                </tbody>
            </table>

            <SimpleCodeChecklist
                    label="Fluid Volume Status:"
                    optionList={[
                        {key:"DRY",text:"Dry"},
                        {key:"EUVO",text:"Euvolemic"},
                        {key:"OVER",text:"Overloaded"}
                    ]}
                    fieldId="ptAsFluidVolume"
                    optionSize={{paddingRight:"10px"}}
                />
            <TextArea 
                label="Activity"
                multiline
                fieldId="ptAsFluidVolumeNotes"
                textFieldProps={{autoAdjustHeight:true,resizable:false,}}
            />

             <TextArea
                label="Clinic Frailty Score"
                /* labelProps={{style:{minWidth:"0px"}}}  */
                fieldId="ptAsClinicFrailtyScore"
            />
            <div style={{pageBreakInside:"avoid"}}>
            <SimpleCodeSelect
                label="NYHA Class:"
                fieldId="ptAsNYHAClass"
                labelPosition="left"
                codeSystem="VALUESET:NYHA.NORMATIVE.ANSWER.LIST"
                size="medium"
            />
            </div>

            <TextArea
                    label="Kansas City Questionnaire:"
                    fieldId="ptAsKCCQ"
            />
            
            <TextArea 
                label="PHQ2:"
                value={fd.field?.data?.PHQ9Questionnaire?.PHQ2Score??`Please complete the PHQ2 Questionnaire`}
                readOnly
                borderless
                fieldId="ptAsPHQ2"
            />
            <SubTitle label="PHQ 2 Questionnaire">
                <div className="hideonprint"><Link href="https://www.hiv.uw.edu/page/mental-health-screening/phq-2" target="_blank">PHQ2 Questionnaire reference</Link></div>
                <br/>
                <table style={{borderCollapse:"collapse",border:"1px solid black", pageBreakInside:"avoid"}}>
                    <tr style={{borderBottom:"2px solid darkgrey", backgroundColor:"lightgray",pageBreakInside:"avoid"}}>
                        <th style={{textAlign:"left", width:"60%",borderCollapse:"collapse"}}>Over the last 2 weeks, how often have you been bothered by any of the following problems?</th>
                        <th style={{textAlign:"center", width:"10%",borderCollapse:"collapse"}}>Not at all</th>
                        <th style={{textAlign:"center", width:"10%",borderCollapse:"collapse"}}>Several Days</th>
                        <th style={{textAlign:"center", width:"15%",borderCollapse:"collapse"}}>More than half days</th>
                        <th style={{textAlign:"center", width:"15%",borderCollapse:"collapse"}}>Nearly everyday</th>
                    </tr>
                    {fd.field?.data?.PHQ9Questionnaire?.Questions.map((obj)=>{
                            
                            return obj.questionIndex<= 2 ?(
                                    <tr style={{backgroundColor:`${obj.questionIndex%2===1?null:'#eee'}`,pageBreakInside:"avoid"}}>
                                        <td style={{padding:"5px 7px",pageBreakInside:"avoid"}}>{`${obj.questionIndex}. ${obj.questionText}`}</td>
                                        <td style={{height:"1px",pageBreakInside:"avoid"}}><DefaultButton toggle checked={obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}0`} className={`${obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}0`?"phqans":""}`} styles={PHQ9btnstyle} text="0" onClick={()=>toggleSelect(obj.questionIndex-1,obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}0`?null:0)}/></td>
                                        <td style={{height:"1px",pageBreakInside:"avoid"}}><DefaultButton toggle checked={obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}1`} className={`${obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}1`?"phqans":""}`} styles={PHQ9btnstyle} text="1" onClick={()=>toggleSelect(obj.questionIndex-1,obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}1`?null:1)}/></td>
                                        <td style={{height:"1px",pageBreakInside:"avoid"}}><DefaultButton toggle checked={obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}2`} className={`${obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}2`?"phqans":""}`} styles={PHQ9btnstyle} text="2" onClick={()=>toggleSelect(obj.questionIndex-1,obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}2`?null:2)}/></td>
                                        <td style={{height:"1px",pageBreakInside:"avoid"}}><DefaultButton toggle checked={obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}3`} className={`${obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}3`?"phqans":""}`} styles={PHQ9btnstyle} text="3" onClick={()=>toggleSelect(obj.questionIndex-1,obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}3`?null:3)}/></td>
                                    </tr>
                                    
                            ):null
                            }
                        )}
                </table>
            </SubTitle>
            
            <div style={{display:`${fd.field?.data?.PHQ9Questionnaire?.PHQ2Score>=3?"block":"none"}`}}>
                <p>As the PHQ2 Score is 3 or greater, then please capture the full PHQ-9</p>
                <TextArea
                    label="PHQ9:"
                    value={fd.field?.data?.PHQ9Questionnaire?.PHQ9Score??`Please complete the PHQ9 Questionnaire`}
                    readOnly
                    borderless
                    fieldId="ptAsPHQ9"
                />
                
                <SubTitle label="PHQ9 Questionnaire">
                    <div className="addapt"><Link href="https://www2.gov.bc.ca/assets/gov/health/practitioner-pro/bc-guidelines/depression_patient_health_questionnaire.pdf" target="_blank">PHQ9 Questionnaire reference</Link></div>
                    <br />
                    
                    <table style={{borderCollapse:"collapse",border:"1px solid black"}}>
                        <tr style={{borderBottom:"2px solid darkgrey", backgroundColor:"lightgray",pageBreakInside:"avoid"}}>
                            <th style={{textAlign:"left", width:"60%",borderCollapse:"collapse"}}>Over the last 2 weeks, how often have you been bothered by any of the following problems?</th>
                            <th style={{textAlign:"center", width:"10%",borderCollapse:"collapse"}}>Not at all</th>
                            <th style={{textAlign:"center", width:"10%",borderCollapse:"collapse"}}>Several Days</th>
                            <th style={{textAlign:"center", width:"15%",borderCollapse:"collapse"}}>More than half days</th>
                            <th style={{textAlign:"center", width:"15%",borderCollapse:"collapse"}}>Nearly everyday</th>
                        </tr>
                        {fd.field?.data?.PHQ9Questionnaire?.Questions.map((obj)=>{
                                
                                return (
                                        <tr style={{backgroundColor:`${obj.questionIndex%2===1?null:'#eee'}`,pageBreakInside:"avoid"}}>
                                            <td style={{padding:"5px 7px",pageBreakInside:"avoid"}}>{`${obj.questionIndex}. ${obj.questionText}`}</td>
                                            <td style={{height:"1px",pageBreakInside:"avoid"}}><DefaultButton toggle checked={obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}0`} className={`${obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}0`?"phqans":""}`} styles={PHQ9btnstyle} text="0" onClick={()=>toggleSelect(obj.questionIndex-1,obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}0`?null:0)}/></td>
                                            <td style={{height:"1px",pageBreakInside:"avoid"}}><DefaultButton toggle checked={obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}1`} className={`${obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}1`?"phqans":""}`} styles={PHQ9btnstyle} text="1" onClick={()=>toggleSelect(obj.questionIndex-1,obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}1`?null:1)}/></td>
                                            <td style={{height:"1px",pageBreakInside:"avoid"}}><DefaultButton toggle checked={obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}2`} className={`${obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}2`?"phqans":""}`} styles={PHQ9btnstyle} text="2" onClick={()=>toggleSelect(obj.questionIndex-1,obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}2`?null:2)}/></td>
                                            <td style={{height:"1px",pageBreakInside:"avoid"}}><DefaultButton toggle checked={obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}3`} className={`${obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}3`?"phqans":""}`} styles={PHQ9btnstyle} text="3" onClick={()=>toggleSelect(obj.questionIndex-1,obj.selectedAnswer.fieldId === `PHQ9Q${obj.questionIndex}3`?null:3)}/></td>
                                        </tr>
                                )
                                }
                            )}
                    </table>
                    
                    

                </SubTitle>
               
                {(fd.field?.data?.PHQ9Questionnaire?.PHQ9Score>9||(fd.field?.data?.PHQ9Questionnaire?.Questions?.[8]?.selectedAnswer?.value>0)) ?
                    <table style={{width:"100%",backgroundColor:"#ffb6c142",pageBreakInside:"avoid",marginLeft:"2em",maxWidth:"858px"}}>
                        <tr style={{pageBreakInside:"avoid"}}>
                            <td style={{width:"21%"}}><Heading text="Inform MD?"/></td>
                            <td style={{width:"15%"}}><SimpleCodeChecklist fieldId="ptAsPHQ9InformDoc" codeSystem="MOIS-YESNO" size="small" optionSize=""/></td>
                            <td style={{width:"60%"}}><TextArea placeholder="Additional Comments" fieldId="ptAsPHQ9InformDocNotes" multiline textFieldProps={{autoAdjustHeight:true,resizable:false}} labelProps={{style:{minWidth:"0px"}}}/></td>
                        </tr>    
                    </table>
                    :
                    null
                }


                {fd.field?.data?.PHQ9Questionnaire?
                <div style={{marginLeft:"2em",maxWidth:"858px"}}> 
                    <SimpleCodeChecklist
                    fieldId="Difficulties"
                    label="If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people? "
                    section={{activeSelector:(fd)=>fd.field.data.PHQ9Questionnaire}}
                    labelPosition="top"
                    optionList={[
                        {key:"0",text:"Not Difficult at all"},
                        {key:"1",text:"Somewhat Difficult"},
                        {key:"2",text:"Very Difficult"},
                        {key:"3",text:"Extremely Difficult"}
                    ]}
                /></div>:null}
                

            </div> 
            <TextArea 
                label="PHQ2/9 Comments"
                fieldId="ptAsPHQ29comments"
                multiline
                textFieldProps={{autoAdjustHeight:true,resizable:false}}
            />
            <table>
                <tr style={{pageBreakInside:"avoid"}}>
                    <td style={{width:"25%",verticalAlign:"text-top"}}><Heading text="Group and/or 1:1 Heart Failure Education Complete?"/></td>
                    <td style={{width:"15%"}}><SimpleCodeChecklist fieldId="ptAsGrpHFEdComplete" codeSystem="MOIS-YESNO" size="small" optionSize=""/></td>
                    <td style={{width:"60%"}}><TextArea placeholder="Additional Comments" fieldId="ptAsGrpHFEdNotes" multiline textFieldProps={{autoAdjustHeight:true,resizable:false}} labelProps={{style:{minWidth:"0px"}}}/></td>
                </tr>    
            </table>


            <TextArea 
                label="MD/NP Assessment and Orders"
                fieldId="ptAsMDNPassessmentAndOrders"
                multiline
                textFieldProps={{autoAdjustHeight:true,resizable:false}}
            />
            
            {/* <Grid placement={`ptAsPHQ9InformDoc  ptAsPHQ9InformDocNotes  ptAsPHQ9InformDocNotes  ptAsPHQ9InformDocNotes`}>

                            <SimpleCodeChecklist label="Inform MD?"
                                codeSystem = "MOIS-YESNO"
                                optionSize={{paddingRight:"10px"}} 
                                fieldId="ptAsPHQ9InformDoc"
                            />
                            
                            <TextArea multiline labelProps={{style:{minWidth:"0px"}}}  fieldId="ptAsPHQ9InformDocNotes"/>
                        
                        </Grid> */}
            
            {/* <SimpleCodeChecklist
                fieldId="ptAsGrpHFEdComplete"
                codeSystem="MOIS-YESNO"
                labelProps={{style:{minWidth:"0px"}}}
                optionSize="tiny"
                labelPosition="left"
                conditionalCodes={["Y","N",null]}
            >
                <TextArea 
                    label="Additional Comments:"
                    fieldId="ptAsGrpHFEdNotes"
                    multiline
                    textFieldProps={{autoAdjustHeight:true,resizable:false}}
                />
            </SimpleCodeChecklist> */}
        </>
        
        
        
        
    )
}

const PHQ9btnstyle={
    root:{
        border:"none"
        ,width:"100%"
        ,height:"100%"
        ,backgroundColor:"inherit"
        ,borderRadius:"0px"
        ,padding:"0px"
    }
    ,rootChecked:{
        backgroundColor:"lightblue"}
    ,rootHovered:{
        backgroundColor:"gainsboro"
    }
}

const border ={border:"1px solid #AAAAAA"}
const tcell = {display:"table-cell", pageBreakInside:"avoid"}

const MeasureRow = ({label, testId, fieldId}) => {
    const [fd]=useActiveData()

    return (
        <div  style={{display:"table-row", pageBreakInside:"avoid"}}>

            <div style={{...tcell,paddingLeft:"5px"}}>{label}</div>
            <div style={tcell,{textAlign:"center !important"}}>
                <SimpleCodeSelect
                    size="small"
                    optionList={[
                        {key:"Better",text:"BETTER"},
                        {key:"Same",text:"SAME"},
                        {key:"Worse",text:"WORSE"},
                        {key:"Yes",text:"YES"},
                        {key:"No",text:"NO"},
                    ]}
                    codeSystem="VALUESET:BETTER.SAME.WORSE"
                    autoHotKey
                    fieldId={fieldId}   
                />
            </div>    
            <div style={{width:"60%",display:"table-cell"}}>
                                
                {/* <div style={fd.field?.data?.[`${fieldId}Notes`]?.length >0?{border:"1px solid black",padding:"6px 8px"}:{}} className="showonprint">
                    {fd.field?.data?.[`${fieldId}Notes`]}
                </div> */}
                <TextArea
                    multiline
                    fieldId={`${fieldId}Notes`}
                    textFieldProps={{autoAdjustHeight:true,resizable:false}}
                    placeholder="Notes"
                />
                
            </div>
        </div>
    )
}

const TableMeasureRow = ({label, testId, fieldId}) => {
    
    return (
        <tr style={{paddingTop:"5px", paddingBottom:"5px"}}>
            <td style={{paddingLeft:"5px",verticalAlign:"top"}}><span style={{margin:"8px 0px"}}>{label}</span></td>
            <td style={{textAlign:"center !important",verticalAlign:"top"}}>
                <SimpleCodeSelect
                    size="small"
                    optionList={[
                        {key:"Better",text:"BETTER"},
                        {key:"Same",text:"SAME"},
                        {key:"Worse",text:"WORSE"},
                        {key:"Yes",text:"YES"},
                        {key:"No",text:"NO"},
                    ]}
                    codeSystem="VALUESET:BETTER.SAME.WORSE"
                    autoHotKey
                    fieldId={fieldId}   
                />
            </td>
            <td>
                <TextArea
                    multiline
                    fieldId={`${fieldId}Notes`}
                    textFieldProps={{autoAdjustHeight:true,resizable:false}}
                    placeholder="Notes"
                />
            </td>

        </tr>
    )
}


/* const tempPanel =[
   
    {
        // Fatigue
        description: "FATIGUE",
        loincCode: "28100-6",
        observationClass: "DCOBS",
        observationCode: "21250",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "VALUESET:BETTER.SAME.WORSE",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
    valueType: "VALUESET",
    },
    {
        // SOB/DYSPNEA
        description: "SHORTNESS OF BREATH",
        loincCode: "45705-1",
        observationClass: "DCOBS",
        observationCode: "45345",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "VALUESET:BETTER.SAME.WORSE",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
        valueType: "VALUESET",
    },
    {
        // PND
        description: "PND: PAROXYSMAL NOCTURNAL DYSPNEA",
        loincCode: null,
        observationClass: "DCOBS",
        observationCode: "A12312",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "VALUESET:BETTER.SAME.WORSE",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
        valueType: "VALUESET",
    },
    {
        // ORTHOPNEA
        description: "ORTHOPNEA",
        loincCode: "82951-5",
        observationClass: "DCOBS",
        observationCode: "X0104",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "VALUESET:BETTER.SAME.WORSE",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
        valueType: "VALUESET",
    },
    {
        // Palpitations
        description: "PALPITATIONS",
        loincCode: null,
        observationClass: "DCOBS",
        observationCode: "A12314",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "VALUESET:BETTER.SAME.WORSE",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
        valueType: "VALUESET",
    },
    {
        // LIGHT-HEADEDNESS
        description: "LIGHT-HEADEDNESS",
        loincCode: null,
        observationClass: "DCOBS",
        observationCode: "A12315",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "VALUESET:BETTER.SAME.WORSE",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
        valueType: "VALUESET",
    },
    {
        // GI COMPLAINTS
        description: "GASTROINTESTINAL COMPLAINTS",
        loincCode: null,
        observationClass: "DCOBS",
        observationCode: "X0105",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "VALUESET:BETTER.SAME.WORSE",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
        valueType: "VALUESET",
    },
    {
        // LIMITS TO ADL
        description: "LIMITS TO ADL",
        loincCode: null,
        observationClass: "DCOBS",
        observationCode: "X0106",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "VALUESET:BETTER.SAME.WORSE",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
        valueType: "VALUESET",
    },
    {
        // CHEST PAIN/ANGINA
        description: "CHEST PAIN",
        loincCode: "58259-3",
        observationClass: "DCOBS",
        observationCode: "58250",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "VALUESET:BETTER.SAME.WORSE",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
        valueType: "VALUESET",
    },
    {
        // USUAL NUMBER OF PILLOWS HEAD ELEVATION
        description: "USUAL NUMBER OF PILLOWS HEAD ELEVATION",
        loincCode: null,
        observationClass: "DCOBS",
        observationCode: "61833",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: null,
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
        valueType: "NUMERIC",
        value:null,
    },
    {
        // CURRENT NUMBER OF PILLOWS HEAD ELEVATION
        description: "CURRENT NUMBER OF PILLOWS HEAD ELEVATION",
        loincCode: null,
        observationClass: "DCOBS",
        observationCode: "61832",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: null,
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
        valueType: "NUMERIC",
        value:null,
    },
    {
        // Legs Swelling
        description: "SWELLING IN LEGS",
        loincCode: null,
        observationClass: "DCOBS",
        observationCode: "A12318",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "VALUESET:BETTER.SAME.WORSE",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
    valueType: "VALUESET",
    },
    {
        // Abdomen Swelling
        description: "ABDOMEN SWELLING",
        loincCode: null,
        observationClass: "DCOBS",
        observationCode: "X0107",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "VALUESET:BETTER.SAME.WORSE",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
    valueType: "VALUESET",
    },
    {
        // EXTRA DIURETICS
        description: "EXTRA DIURETICS",
        loincCode: null,
        observationClass: "DCOBS",
        observationCode: "A12317",
        panelSequenceNumber: 1,
        observationId: 0,
        abnormalFlag: {
            code: null,
            display: null,
            system: "MOIS-ABNORMALFLAG",
        },
        codedValue: {
            code: null,
            display: null,
            system: "MOIS-YESNO",
        },
        collectedBy:null,
        collectedDateTime: null,
        comment: null,
        copyTo: null,
        performedBy: null,
        performedDateTime: null,
        placerReferenceNumber: null,
        rangeAbsurdHigh: null,
        rangeAbsurdLow: null,
        rangeNormalHigh: null,
        rangeNormalLow: null,
        rangeVeryHigh: null,
        rangeVeryLow: null,
        recordState: {
            code: "UNSIGNED",
            display: "Unsigned",
            system: "MOIS-RECORDSTATE",
        },
        referenceRangeText: null,
        report: null,
        reportedBy: null,
        reportedDate: null,
        status: "F",
        units: null,
    valueType: "VALUESET",
    },
] */
/* const PHQ2Quest=
    {"Questions":
        [{
            "questionIndex":1,
            "questionText":"Little interest or pleasure in doing things",
            "selectedAnswer":{
                    "value":null,
                    "description":null,
                    "fieldId":null
                }
            },
            {
            "questionIndex":2,
            "questionText":"Feeling down, depressed, or hopeless",
            "selectedAnswer":{
                "value":null,
                "description":null,
                "fieldId":null
                }
            }
        ],
        "TotalScore":null,
    } */



const PHQ9Quest=
    {"Questions":
        [{
            "questionIndex":1,
            "questionText":"Little interest or pleasure in doing things",
            "selectedAnswer":{
                    "value":null,
                    "description":null,
                    "fieldId":null
                }
            },
            {
            "questionIndex":2,
            "questionText":"Feeling down, depressed, or hopeless",
            "selectedAnswer":{
                "value":null,
                "description":null,
                "fieldId":null
                }
            },
            {
            "questionIndex":3,
            "questionText":"Trouble falling or staying asleep, or sleeping too much",
            "selectedAnswer":{
                "value":null,
                "description":null,
                "fieldId":null
                }
            },
            {
            "questionIndex":4,
            "questionText":"Feeling tired or having little energy",
            "selectedAnswer":{
                "value":null,
                "description":null,
                "fieldId":null
                }
            },
            {
            "questionIndex":5,
            "questionText":"Poor appetite or overeating",
            "selectedAnswer":{
                "value":null,
                "description":null,
                "fieldId":null
                }
            },
            {
            "questionIndex":6,
            "questionText":". Feeling bad about yourself - or that you are a failure or have let yourself or your family down",
            "selectedAnswer":{
                "value":null,
                "description":null,
                "fieldId":null
                }
            },
            {
            "questionIndex":7,
            "questionText":"Trouble concentrating on things, such as reading the newspaper or watching television",
            "selectedAnswer":{
                "value":null,
                "description":null,
                "fieldId":null
                }
            },
            {
            "questionIndex":8,
            "questionText":"Moving or speaking so slowly that other people could have noticed? Or the opposite – being so fidgety or restless that you have been moving around a lot more than usual",
            "selectedAnswer":{
                "value":null,
                "description":null,
                "fieldId":null
                }
            },
            {
            "questionIndex":9,
            "questionText":"Thoughts that you would be better off dead or of hurting yourself in some way",
            "selectedAnswer":{
                "value":null,
                "description":null,
                "fieldId":null
                }
            },
        ],
    "TotalScore":null,
    "PHQ9Score":null,
    "PHQ2Score":null,
    "Difficulties":{}
    }