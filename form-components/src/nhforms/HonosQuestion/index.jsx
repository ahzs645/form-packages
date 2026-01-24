const  { useEffect } = React
const {
  Stack,
  ChoiceGroup,
  Label,
  Text,
  DefaultButton,
  Dropdown,
  StackItem,
  TooltipHost,
  Separator,
  ILabelStyles,
  IStackSlots,
  IChoiceGroupStyles,
} = Fluent

type HonosItem = {
  selectedKey: string
  selectedDropdownKey?: string
  value: number
}

type FormData = {
  [id:string]: HonosItem
}

// ================================================
// Styles definition
// ================================================

const QUESTION_NO_STACK_ITEM_STYLE: ILabelStyles = {
  root: {
    display: "flex",
    width: 18,
    margin: "0px 0px 0px 0px",
  },
}

const QUESTION_defaultLabelStyle = {
  root: {
    // display: "flex",
    margin: "0px 0px 0px 0px",
    width: 250,
  },
}

const CHOICE_FIELD_STYLE = {
  root: {
    padding: "0px 10px 5px 15px",
    width: 80,
    overlap: "hidden",
    textAlign: "center",
  },
}

const QUESTION_STACK_STYLE = {
  margin: "0px 0px 0px 0px",
}

const choiceGroupStyle: IChoiceGroupStyles = {
  flexContainer: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
  },
}

// End of Styles definition
// ================================================

// ================================================
// Constant definition for the Choice Group
// ================================================

const SCALE_5_LEGENDS = [
  "No problem",
  "Minor not requiring action",
  "Mild but present",
  "Moderate",
  "Severe to very severe",
  "Unknown or not asked",
]

const SCALE_5_OPTIONS = [
  { key: "0", value: 0, text: "0", styles: CHOICE_FIELD_STYLE },
  { key: "1", value: 1, text: "1", styles: CHOICE_FIELD_STYLE },
  { key: "2", value: 2, text: "2", styles: CHOICE_FIELD_STYLE },
  { key: "3", value: 3, text: "3", styles: CHOICE_FIELD_STYLE },
  { key: "4", value: 4, text: "4", styles: CHOICE_FIELD_STYLE },
  { key: "9", value: 0, text: "9", styles: CHOICE_FIELD_STYLE },
]

// End of Constant Definition
// ================================================

// ================================================
// Control Definition
// ================================================

const Scale5QuestionList = props => {
  return (
    <div>
      {props.children}
    </div>
  )
}

const Scale5SubmitButton = props => {
  const [fd] = useActiveData()

  return (
    <Stack horizontal wrap tokens={{ childrenGap: "m" }}>
      <SubmitButton
        {...props}
      />
      <DefaultButton
        data-automation-id='fill'
        text='Fill all the unfilled questions with 9'
        onClick={e => {
          fillAllUnfilledQuestions(fd)
        }}
      />
    </Stack>
  )
}

const Scale5Legend = () => {
  const legendRowStyle: IComponentStyles<IStackSlots> = {
    root: {
      justifyContent: "space-between",
      width: "100%",
    },
  }

  const legendStyle: React.CSSProperties = {
    padding: "5px 15px 0px 0px",
    width: 75,
    textAlign: "center",
  }

  let i = 0
  return (
    <Stack horizontal wrap style={QUESTION_STACK_STYLE}>
      <StackItem disableShrink>
        <Label styles={QUESTION_NO_STACK_ITEM_STYLE}>
          &nbsp;
        </Label>
      </StackItem>
      <StackItem disableShrink>
        <Stack>
          <Label styles={QUESTION_defaultLabelStyle}>{/* <b>Questions</b> */}&nbsp;</Label>
        </Stack>
      </StackItem>
      <StackItem grow>
        <Stack horizontal styles={legendRowStyle} tokens={{ padding: 5 }}>
          {SCALE_5_LEGENDS.map(legend => {
            return (
              <Text key={i++} style={legendStyle}>
                <b>{legend}</b>
              </Text>
            )
          })}
        </Stack>
      </StackItem>
    </Stack>
  )
}

type Scale5Props = {
  id?: string
  label?: JSX.Element
  dropdownOptions?: any
  tooltip?: { rating: number, description: string }[]
  disableCount?: boolean
  question?: string
}

const Scale5 = ({id,label,dropdownOptions,tooltip,disableCount,question}: Scale5Props) => {
  const [honosData,modHonosData]: [FormData,Setter] = useActiveData(fd=>fd.field.data)
  const [fd] = useActiveData()
  const theme = useTheme()

  let defaultHonosItem: HonosItem = { selectedKey: null, value: null, question, response: null }
  if (dropdownOptions) defaultHonosItem = { ...defaultHonosItem, selectedDropdownKey: null}
  const rawfditem = honosData[id]
  const fditem = rawfditem || defaultHonosItem
  useEffect(() => {
    if (rawfditem==null) {
      // null or undefined
      modHonosData({[id]:defaultHonosItem})
    }
  },[id,rawfditem,defaultHonosItem,modHonosData])

  // Disable color style
  let questionStyle = {
    backgroundColor: "#FBFBFB",
    padding: "5px 0px 5px 10px",
    marginBottom: "1px",
  }

  if (fditem.selectedKey && (!dropdownOptions || fditem.selectedDropdownKey)) {
    // Once user has selected the control, the color will be updated
    questionStyle.backgroundColor = theme.semanticColors.bodyBackground
  }

  const dropdownStyles = {
    dropdown: {
      width: 200,
      padding: "5px 0px 0px 0px",
    },
    title: {
      background: (!dropdownOptions || fditem.selectedDropdownKey)
        ? theme.semanticColors.bodyBackground
        : theme.aihs.requiredBackground
    },
  }
  
  return (
    <div style={questionStyle}>
      <TooltipHost
        id={"tooltip_" + id}
        tooltipProps={
          tooltip && {
            onRenderContent: () => {
              return <Scale5ToolTip tooltip={tooltip} />
            },
          }
        }
      >
        <Stack horizontal wrap style={QUESTION_STACK_STYLE}>
          <StackItem disableShrink>
            <Label styles={QUESTION_NO_STACK_ITEM_STYLE}>
              {id + ". "}
            </Label>
          </StackItem>
          <StackItem disableShrink>
            <Stack>
              <Label styles={QUESTION_defaultLabelStyle}>{label}</Label>
              {dropdownOptions && (
                <Stack horizontal>
                  <Dropdown
                    placeholder='Please Select'
                    options={dropdownOptions}
                    styles={dropdownStyles}
                    selectedKey={fditem.selectedDropdownKey}
                    onChange={(e, option, index) =>
                      handleDropdownChanged(option, id, honosData, modHonosData)
                    }
                  />
                </Stack>
              )}
            </Stack>
          </StackItem>
          <StackItem grow>
            <ChoiceGroup
              id={"choiceGroup-" + id}
              name={id}
              key={id}
              tabIndex={0}
              options={SCALE_5_OPTIONS}
              styles={choiceGroupStyle}
              selectedKey={fditem.selectedKey}
              onKeyUp={e =>
                handleKeyUp(
                  id,
                  e,
                  fditem,
                  fd,
                  dropdownOptions,
                  disableCount,
                  tooltip
                )
              }
              onChange={(e, option) =>
                handleChoiceChanged(
                  id,
                  option,
                  fditem,
                  fd,
                  dropdownOptions,
                  disableCount,
                  tooltip
                )
              }
            />
          </StackItem>
        </Stack>
      </TooltipHost>
    </div>
  )
}

const Scale5ToolTip = props => {
  if (props.tooltip) {
    let i = 0
    const tooltipList = props.tooltip.map(item => {
      return (
        <Stack horizontal key={i++} styles={{ root: { paddingBottom: 5 } }}>
          <StackItem styles={{ root: { minWidth: 30 } }}>
            {item.rating}
          </StackItem>
          <StackItem>{item.description}</StackItem>
          <Separator />
        </Stack>
      )
    })
    return tooltipList
  } else {
    return null
  }
}

const HonosFinalScore = props => {
  const finalScoreStyle = {
    margin: "0px 0px 15px 0px",
  }

  return (
    <div style={finalScoreStyle}>
      <Text variant='xLarge'>
        <b>Final Score: {props.totalScore}</b>
      </Text>
    </div>
  )
}

// end of Control Definition
// ================================================

// ================================================
// Event Handler
// ================================================

const fillAllUnfilledQuestions = (fd: ActiveDataType) => {
  let forms: FormData = {}
  for (const id in fd.field.data) {
    if (/\d+/.test(id)) {
      const question: HonosItem =  fd.field.data[id]

      if (!question?.selectedDropdownKey) {
        forms = {
          ...forms,
          [id]: {
            ...question,
            selectedDropdownKey: "J",
          },
        }
      }
      if (!question?.selectedKey) {
        forms = {
          ...forms,
          [id]: {
            ...question,
            selectedKey: "9",
            value: 0,
            response: "Unknown or not asked",
            detailResponse: "Unknown or not asked",
          },
        }
      }
    }
  }

  fd.setFormData({
    ...fd,
    field: {
      ...fd.field,
      data: {
        ...fd.field.data,
        ...forms,
      },
    },
  })

}

const handleKeyUp = (
  id: string,
  e: React.KeyboardEvent,
  selectedQuestion: HonosItem,
  fd: ActiveDataType,
  hasDropdown: boolean,
  disableCount: boolean,
  tooltip: any[]
) => {
  const selectedOptions = SCALE_5_OPTIONS.filter(option => {
    return option.key === e.key
  })

  if (selectedOptions.length === 1) {
    const nextChoiceGroup = window.document.querySelector(
      "#choiceGroup-" + (parseInt(id) + 1)
    ) as HTMLElement

    if (nextChoiceGroup) {
      nextChoiceGroup.focus()
    }

    handleChoiceChanged(
      id,
      selectedOptions[0],
      selectedQuestion,
      fd,
      hasDropdown,
      disableCount,
      tooltip
    )
  }
}

const handleDropdownChanged = (option, id: string, forms: FormData, modForms: Setter) => {
  const item = forms[id]

  const updatedValue: HonosItem = {
    ...item,
    selectedDropdownKey: option.key,
  }

  modForms({ [id]: updatedValue })
}

const handleChoiceChanged = (
  id: string,
  option,
  question,
  fd: ActiveDataType,
  hasDropdown: boolean,
  disableCount: boolean,
  tooltip: any[]
) => {
  const item = fd.field.data[id]

  let value = parseInt(option.value)
  if (
    disableCount ||
    (item &&
      ((hasDropdown && !item.selectedDropdownKey) ||
        item.selectedDropdownKey === "J")) ||
    (!item && hasDropdown)
  ) {
    value = 0
  }

  const updatedValue: HonosItem = {
    ...item,
    selectedKey: option.key,
    value,
    response: SCALE_5_LEGENDS[parseInt(option.key)] ?? "Unknown or not asked",
    detailResponse: tooltip?.[parseInt(option.key)]?.description ?? SCALE_5_LEGENDS[parseInt(option.key)] ?? "Unknown or not asked",
  }

  console.log("Choice changed: ",id,option,question,tooltip,updatedValue)
  UpdateContext(fd, id, updatedValue)
}

const UpdateContext = (fd, id, values) => {
  fd.setFormData({
    ...fd,
    field: {
      ...fd.field,
      data: {
        ...fd.field.data,
        [id]: values,
      },
    },
  })
}
