type WatchState = { savedValue: any, renderCount: number }
type WatchResult = [
  hasChanged:boolean,
  setHasChanged:((hasChanged?: boolean, delayCount?:number)=>void)
]
const useChangeWatch = ( watchedValue: any, delayCount:number=3 ):WatchResult => {

  const [ watcher, setWatcher ] = useState({ savedValue: watchedValue, renderCount: delayCount } as WatchState)

  const setChanged = useCallback((isChanged:any=false,resetCount:number=delayCount) => {
    if (isChanged) {
      setWatcher(old => ({ ...old, savedValue: null }))
    } else {
      setWatcher({ savedValue: watchedValue, renderCount: resetCount })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  useEffect(() => {
    if (watcher.renderCount>0) {
      setWatcher(old => ({ ...old, renderCount: watcher.renderCount-1 }))
    }

  },
  [ watchedValue ])

  return [
    watchedValue!==watcher.savedValue && watcher.renderCount<=0,
    setChanged,
  ]
}
