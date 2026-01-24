
const HFC_PT_ASMT_PatientSummary = (props) => {
    const [fd,setFd]=useActiveData()
    const sd = useSourceData()
    
    /* const connectionMutation = props.mutations */
    const [hideSubForm, setHideSubForm] = React.useState(true)
    const { auth, errorDispatch } = sd

    const [connectionMutation] = useMutation(
        `mutation updateConnection($patientId: Int!, $connection: ConnectionInput!) {
            changeConnection(patientId: $patientId, connection: $connection) {
              patientId
            }
        }`,
        { auth },
        errorDispatch)

    

        
    const sortStartDateDesc = (a,b) => {

        if (!a.startDate) {
            // Change this values if you want to put `null` values at the end of the array
            return +1;
        }
    
        if (!b.startDate) {
            // Change this values if you want to put `null` values at the end of the array
            return -1;
        }
        
        return b.startDate.localeCompare(a.startDate); 
    }

    const EFHistory = sd.patient.observations.filter(item=> item.observationCode==="2455" && new Date((item.collectedDateTime??"1900-01-01T00:00:00").split("T")[0])<=new Date(fd.field.data.docDate)).sort(latestCollectedFirst);

    

    

    const EFcols =[ 
        {
            id:"observationId",
            type:"key"
        },
        {
            id:"checklatest",
            type:"string",
            size:"small",
            onColumnMap:(item)=>EFHistory.indexOf(item)==0?"Latest as of document date":null
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
        /* {
            title:"Test name",
            id:"description",
            type:"string",
            size:"medium"
            
        }, */
        {
            title:"Measure",
            id:"vwunits",
            type:"string",
            onColumnMap:(item)=>`${item.value??'-'} ${item.units}`,
            size:"tiny"
        }
    ]

    const finalSourceMap = MoisFunction.mapSourceToActive(EFcols);

    return (
        <>
            <TextArea 
                  label="Created By"
                  labelPosition="left"
                  fieldId="docCreatedBy"
                  value =  {fd.field?.data?.docCreatedBy}
                  defaultValue={fd.field?.data?.docCreatedBy??sd.userProfile.identity.fullName}  
                  readOnly 
                  size="medium"  
              />
                       
            {/* <TextArea
                label="Service Location"
                fieldId="encSvcLocation"
                value = {fd.field.data.encSvcLocation}
                defaultValue={sd.webform?.encounter?.location??null}
                readOnly
                size="medium"
            /> */}

            <DateSelect
                label="Date Created"
                labelPosition="left"
                fieldId="docDate"
                defaultValue={fd.field?.data?.docDate??getDateString(new Date(),"-")}
                value={fd.field.data.docDate}
                size="medium"
            />

        <SubTitle text="Client Demographics" />
                            
            <LayoutItem label="Current Status" fieldId="activelayout"  labelPosition="left">
                <TextArea
                    fieldId="active"
                    value ={fd.field?.data?.active}
                    defaultValue={sd.patient?.active?.display??null}
                    readOnly   
                />
            </LayoutItem>

            {/* <LayoutItem label="Current Status" fieldId="healthNumber"  actions={{onEdit:true}} labelPosition="left" moisModule="DEMOGRAPHICS">
                <TextArea
                    fieldId="active"
                    value ={fd.field?.data?.active}
                    defaultValue={sd.patient?.active?.display??null}
                    readOnly   
                />
            </LayoutItem> */}

            <Mois.Patient.healthNumber />
            <Mois.Patient.insurance />
            <Mois.Patient.address />
            <Mois.Patient.telecom />
            <Mois.Patient.preferredPhone />
       

        <SubTitle text="Service Request Details" />
        
            <ReferralSource />
            <ServiceRequests />
            <Heading label="Primary Care Provider(s)" moisModule="DEMOGRAPHICS">
                <ListSelection 
                        id="connections" 
                        columns={getListSelectionColumns(sd,fd,setHideSubForm,connectionMutation)} 
                        filterPred={(item)=>item.connectionType.code==="PRIMARY" && !Boolean(item.stopDate)} 
                        detailsListProps={{styles:{root: {maxHeight: "400px", overflowX:"hidden",overflowY:"auto"}}}}
                        listCompare={sortStartDateDesc}
                />
                
                <div>
                    <span style={{dispay:"flex", justifyContent:"center"}}>Add new provider connection</span>
                    <Action.Add onAdd={()=> handleEditConnection(fd, setHideSubForm, connectionTemplate)}/>
                </div>
            </Heading>
            {/*Insert connections table for Primary Providers only*/}

        <SubTitle text="Patient Summary" />
            
            <Heading label="Summary List of Health Issues" moisModule="HEALTH ISSUE"/>
            {sd.queryResult?.patient[0]?.conditions?.filter(item=> (item.resolveDate ==null && item.condition.display !== null)).length >0 ?
            
                <ListSelection
                    id="conditions"
                    selectionType="none"
                    columns={healthIssuesCols}
                    
                    detailsListProps={{styles:{root: {maxHeight: "400px", overflowX:"hidden",overflowY:"auto"}}}}
                    filterPred={(item)=>(item.resolveDate == null && item.condition.display !== null)}
                    
                    listCompare = {sortStartDateDesc}
                />
                
            :
                <span>No Health Issues found for this patient</span>}
            
            <TextArea
                label="Diagnosis:"
                fieldId="ptSumDiag"
               
                multiline
                labelPosition="left"
                
            />
            <DateSelect fieldId="ptSumDateDiag" label="Date of Diagnosis"/>
            
            <TextArea
                label="Cause of LV Dysfunction: "
                fieldId="ptSumLVdys"
                labelPosition="left"
                textFieldProps={{autoAdjustHeight:true,resizable:false}}
                multiline
            />
            <Heading label="Ejection Fraction History" labelStyles={{style:{fontWeight:"600"}}}>
                
                {EFHistory.length >0?                
                
                <Column height={300}>
                    <ListSelection 
                        items={EFHistory.map(finalSourceMap)}
                        filterPred={item=> item.observationCode==="2455" && new Date((item.collectedDateTime??"1900-01-01T00:00:00").split("T")[0])<=new Date(fd.field.data.docDate) && EFHistory.indexOf(item)>=0}
                        columns={EFcols}
                        listCompare={latestCollectedFirst}
                    /> 

                </Column>
                :
                <span style={{paddingBottom:"15px"}}>Ejection Fraction history not found for this patient</span>
                }
            
            </Heading> 



            <TextArea
                label="Initial Ejection Fraction (EF) at Diagnosis: "
                fieldId="ptSumInitialEF"
                labelPosition="left"
                textFieldProps={{autoAdjustHeight:true,resizable:false}}
                multiline
            /> 

            <TextArea
                label="Device Therapy: "
                fieldId="ptSumDeviceTherapy"
                labelPosition="left"
                textFieldProps={{autoAdjustHeight:true,resizable:false}}
                multiline
            />

            <Heading text="Cardiac Procedures:">
                <TestResult
                    fieldId="ptSumCABG"
                    label="CABG: "
                    type="measure"
                    testCode="X0102"
                    />

                <TestResult
                    fieldId="ptSumPCI"
                    label="PCI: "
                    type="measure"
                    testCode="80498"/>
                               
                <TestResult
                    fieldId="ptSumAngio"
                    label="Angio: "
                    type="procedure"
                    testCode="77343006"/>

                <TestResult
                    fieldId="ptSumValveSurgery"
                    label="Valve Surgeries/Procedures: "
                    type="YN"
                    />
                
                <TestResult
                    fieldId="ptSumHolter"
                    label="Holter: "
                    type="measure"
                    testCode="473"
                    />

                <TestResult
                    fieldId="ptSumECGQRS"
                    label="ECG (QRS Width): "
                    type="measure"
                    testCode="479"
                    />

                <TestResult
                    fieldId="ptSumEcho"
                    label="ECHO: "
                    type="measure"
                    testCode="10755"/>

                <TestResult
                    fieldId="ptSumMUGA"
                    label="MUGA: "
                    type="procedure"
                    testCode="404221001"
                    />

                <TestResult
                    fieldId="ptSumMIBI"
                    label="MIBI: "
                    type="procedure"
                    testCode="431511008"
                    />

                <TestResult
                    fieldId="ptSumEST"
                    label="EST: "
                    type="measure"
                    testCode="475"
                    />

                <TextArea
                    label="Notes: "
                    fieldId="ptSumCDNotes"
                    labelPosition="left"
                    labelProps={{style:{minWidth:"0px"}}} 
                    textFieldProps={{autoAdjustHeight:true,resizable:false}}
                    multiline
                />
                <SimpleCodeChecklist 
                    label="Cardiac Devices:"
                    fieldId="ptSumCDNotesChecklist"
                    optionList={[
                        {key:"None",text:"None"},
                        {key:"ICD",text:"ICD"},
                        {key:"CRT",text:"CRT"},
                        {key:"PPM",text:"PPM"}
                    ]}
                    optionSize="small"
                />
            </Heading>

            <DateSelect
                fieldId="ptSumFirstSeen"
                label="First time seen at the clinic: "
                labelPosition="left"
                />

            <TextArea 
                label="Significant PMH/Substance Use: "
                fieldId="ptSumSubstUse"
                multiline
                labelPosition="left"
                /* labelProps={{style:{minWidth:"0px"}}} */ 
                textFieldProps={{autoAdjustHeight:true,resizable:false}}
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

            <Heading label="Reaction Risks" moisModule="REACTION_RISKS" />
            
                {sd.patient?.allergies?.length >0
                ? 
                    <ListSelection
                        items={sd.patient.allergies}
                        columns={allergiesCols}
                        selectionType="none"
                        detailsListProps={{styles:{root: {maxHeight: "400px", overflowX:"hidden",overflowY:"auto"}}}}
                    />
                  
                :<span>No reaction risks have been recorded for this patient.</span>}
            
            
            <span><strong>Medication Notes</strong> (for medication reconciliation, please complete in the Long Term Medications folder <LinkToMois moisModule="LONG TERM MEDS" />):</span>
            <TextArea 
                fieldId="ptSumMedNotes"
                multiline
                textFieldProps={{autoAdjustHeight:true,resizable:false}}
                />

        {!hideSubForm && (
        <ConnectionEditSubForm
          {...{hideSubForm, setHideSubForm,connectionMutation}}
          
        />
      )}
        </>
    )
}

function getLastRead(code){
    const sd= useSourceData();    
    const [fd] = useActiveData();

    /* var labs = sd.patient?.observations?.filter(lcode => lcode.observationCode === code)??Array(0); */
    var labs = sd.patient?.observations?.filter(lcode => lcode.observationCode === code && new Date((lcode.collectedDateTime??"1900-01-01T00:00:00").split("T")[0])<=new Date(fd.field.data.docDate))??Array(0);
    
    /* console.log(code);
    console.log(labs); */
    
    if (labs.length > 0) 
    {
        
        var val;
        var unit;
        var date;

        labs = labs.sort(latestCollectedFirst);

        val= labs[0].value;
        unit = labs[0].units;
        date = labs[0].collectedDateTime.split("T")[0];

        return `(${date}) ${val} ${unit??''}`;   
    }
    else{
        return "No Measure Found"
    }
    
}

const handleCreateConnection = async (
    createConnection,
    patientId,
    sd,
    coninfo,
    setHideSubForm
  ) => {
    console.log(coninfo)   
    /* alert("This is what you're saving: ", coninfo) */
    const result = await createConnection({
      patientId: patientId,
      connection: coninfo,
    })
    console.log(result)
    if (result?.changeConnection) {
      setHideSubForm(true)
      refresh(sd)
    }
  }

  

const ConnectionEditSubForm = ({
    connectionMutation,
    hideSubForm,
    setHideSubForm,
    ...rest
}) => {
    const sd = useSourceData()
    const [fd, setFd] = useActiveData()
    const defaultProviderTypeLookup = sd.optionLists["MOIS-CONNECTIONTYPEDEFAULT"]
  
    // The following code is used to clear the selected provider details
    // when the provider type (aka: connection resource) is changed.
    // It does not fire on "initial mount" of the data, but rather when
    // the selection is changed in the UI.
    const isInitialMount = React.useRef(true)
    React.useEffect(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false
      } else {
        fd.setFormData(
          produce((draft) => {
            draft.tempArea.connectionEdit.provider = {}
          })
        )
      }
    }, [fd.tempArea?.connectionEdit?.providerType?.code])
    // -- END clearing provider code
  
    // The following code watches changes to the connection type and updates the
    // associated provider type to the default option for it
    React.useEffect(() => {
      const connectionTypeCode = fd.tempArea?.connectionEdit?.connectionType?.code
      const defaultProviderType = defaultProviderTypeLookup[connectionTypeCode]
  
      // if the default provider type should be changed
      if (
        fd.tempArea?.connectionEdit?.providerType?.code !== defaultProviderType
      ) {
        fd.setFormData(
          produce((draft) => {
            draft.tempArea.connectionEdit.providerType = {
              code: defaultProviderType,
            }
          })
        )
      }
    }, [fd.tempArea?.connectionEdit?.connectionType?.code])
    // -- END updating the provider type
    
    /* const gridRows = fd.tempArea?.connectionEdit?.connectionId > 0??false */
         
    return (
      <SubForm
        hidden={hideSubForm}
        onCancel={() => setHideSubForm(true)}
        minWidth={700}
        tempArea="connectionEdit"
      >
          <Row>
              <SimpleCodeSelect
                  id="connectionType"
                  readOnly
                  codeSystem={defaultProviderTypeLookup}
                  defaultValue={{code:"PRIMARY",display:"Primary Provider", system:"MOIS-CONNECTIONTYPE"}}
                  label="Connection Role"
                  section={{activeSelector:(fd)=>fd.tempArea.connectionEdit}}
              />
  
              <SimpleCodeSelect 
                  id="providerType"
                  codeSystem="MOIS-CONNECTIONPROVIDERTYPE"
                  optionList={providerTypes}
                  readOnly={fd.tempArea?.connectionEdit?.connectionId > 0}
                  label="Connection Type"
              />
          </Row>
          <Row>
              <Mois.Connection.provider
                  mapCandidateSavedValue={savedValueMapper}
                  providerType={lookupSelectedProviderType(fd)}
                  />
          </Row>
          <Row>
              <Mois.Connection.startDate />
              <Mois.Connection.includeOnDemographics />
              <Mois.Connection.isCareTeamMember />
              
          </Row>
          <Row>
              <Mois.Connection.stopDate />
          </Row>
          {Boolean(fd.tempArea?.connectionEdit?.stopDate??null)?
              <>
                  <Row>
                      <Mois.Connection.stopReason />
                  </Row>
                  <Row>
                      <Mois.Connection.stopNote />
                  </Row>
              </>
          :null
          }
          
          <Row>
              <Mois.Connection.comment />
          </Row>
        
              
        <ButtonBar>
          <Fluent.PrimaryButton
            onClick={() =>
              handleCreateConnection(connectionMutation, sd.formParams.patientId, sd, fd.tempArea.connectionEdit ,setHideSubForm)
            }
            text={fd.tempArea?.connectionEdit?.connectionId > 0?"Save Changes":"Create"}
          />
          <Fluent.DefaultButton
            onClick={() => setHideSubForm(true)}
            text="Cancel"
          />
        </ButtonBar>
        <DebugView excluded={{uiState:"...",field:"..."}}/>
      </SubForm>
    )
}

const TestResult = ({fieldId,label,testCode,value,type,...props}) => {
    const sd = useSourceData();

        var disp;
        
        if (type==="measure"){
            disp = 
                <TextArea
                    label={label}
                    value={Boolean(testCode)?(getLastRead(testCode)):null}
                    labelPosition="left"
                    fieldId = {fieldId}
                    labelProps={{style:{minWidth:"0px"}}}
                    readOnly
                    borderless={true}
                />
        }
        else if (type==="procedure") {
            disp = 
                <>
                    <div style={{display:"flex",alignContent:"center"}}>
                        <span style={{padding:"5px 10px 5px 0px",fontFamily: "Segoe UI,Segoe UI Web (West European), Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif",fontSize:"14px", fontWeight:"600"}}>{`${label}`}<LinkToMois moisModule="PROCEDURES" styles={{root:{minHeight:"0px"}}}/></span>
                        <span style={{padding:"5px 0px",fontSize:"14px",display:"inline-flex",alignItems:"center"}}>Unable to display Procedure result. Please review in MOIS.</span> 
                    </div>
                </>
        }
        else{
            disp = 
            <SimpleCodeChecklist fieldId={fieldId} label={label} codeSystem="MOIS-YESNO" optionSize="tiny" labelProps={{style:{minWidth:"0px"}}}/>
        }

        return (
            <div style={{display:"flex",flexDirection:"row",justifyContent:"space-between",padding:"0px 5px", borderBottom:"1px solid lightgrey"}}>
                <div style={{width:"60%"}}>
                    {disp}
                </div>
                <div style={{width:"40%"}}>
                    <TextArea
                        /* value={fd.field?.data?.[`${fieldId}notes`]} */
                        fieldId={`${fieldId}notes`}
                        textFieldProps={{autoAdjustHeight:true,resizable:false,styles:{root:{minWidth:"350px"}}}}
                        placeholder="Notes"
                        multiline
                    />
                </div>
            </div>
        )
    

}


const handleEditConnection = async (fd, setHideSubForm,connection) => {
    fd.setFormData(
        produce((draft) => {
        // key and name are non-persistent, so destructure them from the edit-data
        let { key, name, ...editableConnection } = connection
        draft.tempArea.connectionEdit = editableConnection
        })
    )
    setHideSubForm(false)
}

const getListSelectionColumns = (
    sd,
    fd,
    setHideSubForm,
    connectionMutation
  ) => {
    return [
      {
        id: "connectionId",
        type: "key",
      },
      {
        title: "Start",
        id: "startDate",
        type: "date",
      },
      {
        title: "Role",
        id: "connectionType",
        type: "code",
      },
      {
        title: "Name",
        id: "name",
        type: "string",
      },
      {
        title: "Actions",
        id: "link",
        type: "action",
        size: "tiny",
        onRender: (connection) => {
          return (
            <Action.Bar
              /* onDelete={(e) => {
                currentConnection = connection
                setHideDialog(false)
              }} */
              onEdit={() => handleEditConnection(fd, setHideSubForm, connection)}
            />
          )
        },
      },
      {
        id: "comment",
        type: "hidden",
      },
      {
        id: "includeOnDemographics",
        type: "hidden",
      },
      {
        id: "isCareTeamMember",
        type: "hidden",
      },
      {
        id: "provider",
        type: "hidden",
      },
      {
        id: "providerType",
        type: "hidden",
      },
      {
        id: "stopDate",
        type: "hidden",
      },
      {
        id: "stopReason",
        type: "hidden",
      },
      {
        id: "stopNote",
        type: "hidden",
      },
    ]
  }
  
  
  
      const connectionTemplate = {
          connectionId: 0,
          includeOnDemographics: { code: "Y", display: "Yes", system: "MOIS-YESNO" },
          isCareTeamMember: { code: "N", display: "No", system: "MOIS-YESNO" },
      }
  
      let currentConnection = {
          connectionId: 0,
      }
  
     

    
      
      const lookupSelectedProviderType = (fd) => {
      const code = fd.tempArea?.connectionEdit?.providerType?.code
      return providerTypes.find((x) => x.code === code)?.type
      }
  
      const savedValueMapper = (provider) => {
      const result = {
          code: provider.code ? provider.code : null,
          name: provider.name ?? provider.display ?? null,
          source: provider.sourceId ? provider.source : "FREE TEXT",
          sourceId: provider.sourceId ?? null,
      }
      // handy for debugging
      // console.log("original:", provider)
      // console.log("after map:", result)
      return result
      }
  
      const providerTypes = [
          { code: "100", display: "PROVIDER (EXT)",type:"PROVIDER EXTERNAL" },
          { code: "110", display: "PROVIDER (INT)",type:"PROVIDER" },  
      ]

      const ltRXcols = [
        {
            id:"code",
            type: "key"    
        },
        {
            title:"Start",
            itemId:"startDate",
            type:"date",
            size:"tiny"
        },
        {
            title:"End",
            itemId:"endDate",
            type:"date",
            size:"tiny"
        },
        {
            title:"Medication",
            itemId:"medication",
            type:"string",
            size:"large"
        },
        {
            title:"Dose Frequency",
            itemId:"doseFrequency",
            type:"string",
            size:"small"
        }    
    ]

    const healthIssuesCols=[
        {
            id:"conditionId",
            type:"key"
        },
        {
            title:"Start Date",
            id:"startDate",
            type:"date",
            size:"tiny"
        },
        {
            title:"Condition",
            id:"condition",
            type:"code",
            size:"large"
        },
        {
            title:"Certainty",
            id:"certainty",
            type:"code"
        },
        {
            title:"Severity",
            id:"severity",
            type:"code"
        }
    ]

    const allergiesCols=[
        {
            id:"code",
            type:"key"
        },
        {
            title:"Type",
            itemId:"intoleranceType",
            type:"text",
            size:"small"
        },
        {
            title:"Start",
            itemId:"startDate",
            type:"date",
            size:"tiny"
        },
        {
            title:"End",
            itemId:"endDate",
            type:"date",
            size:"tiny"
        },
        {
            title:"Substance",
            itemId:"substance",
            type:"text",
            size:"large"
        },
        {
            title:"Reaction",
            itemId:"reations",
            type:"text",
            size:"medium"
        }

    ]

    const latestCollectedFirst = (a, b) => {
        const acol = a.collectedDateTime ? a.collectedDateTime : "2100-01-01"
        const bcol = b.collectedDateTime ? b.collectedDateTime : "2100-01-01"
        return asciiCompare(acol, bcol)
      }
    
      const ConditionsSortDesc = (a, b) => {
        const acol = a.startDate ? a.startDate : "2100-01-01"
        const bcol = b.startDate ? b.startDate : "2100-01-01"
        return -asciiCompare(a, b)
      }
      
    const asciiCompare = (a, b) => (a < b ? +1 : a > b ? -1 : 0)
    
    

