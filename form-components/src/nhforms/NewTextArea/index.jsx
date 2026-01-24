const NewTextArea = (props) => {

    const sourceData = useSourceData()
    const [fd,setFd] = useActiveData(useSection().activeSelector)

    const hideonprint = Fluent.mergeStyles({
        '@media print':{
            display:'none !important;'
        }
    })

    const showonprint = Fluent.mergeStyles({
        '@media print':{
            display:'block !important;'
        },
        display:'none'
    })

    return(
        <div>
            <div class={showonprint}>
                <div style={{display:"flex",flexDirection:`${props.labelPosition ==="top"?"column":"row"}`, marginTop:"8px", marginBottom:"8px" }}>
                    {props.label?.length >0 ?
                        <Fluent.Label styles={{root:{flexGrow:"1", maxWidth:"240px",marginRight:"10px"}}}>{props.label}</Fluent.Label>
                    : null}
                    <div style={{padding:"6px 8px", border:"1px solid black", whiteSpace:"pre-wrap",flexGrow:"2",minHeight:`${props.multiline?"60px":null}`}}>{fd[props.fieldId]}</div>
                </div>
            </div>

            <div class={hideonprint}>
                <TextArea
                    {...props}
                />
            </div>
        </div>
    )
}
