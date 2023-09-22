import React, { useEffect, useRef, useState } from 'react'
import { readAsArrayBuffer } from './libs/file-util';
import { IdbStorage } from './libs/idb-storage';
import { collectAsyncIterableAsArray, filterAsyncIterable } from "./libs/iterator-tools.js"
import { getId3 } from './libs/mp3-util';
import {WcServiceWorker} from './libs/sw-worker';
function Home() {
  const [musicData, setMusicData] = useState({});
  const playerRef = useRef();
  const progressElRef = useRef();
  const [mediaList, setMediaList] = useState([])
  const [ PlayP, setPlay]= useState(false);
  const [ mouseDownOnSlider, setmouseDownOnSlider]= useState(false);
  const [cp ,setCP] = useState('')
  const [playList, setPlayList] = useState(false)
  const [cPlayer, setcPlayer] = useState({
    currentID:-1,
  });

  let handle
	let storage
	let files = [];
	let fileLinks
	let isPlaying = false;
	let isReady;
	let setLoaded;
  async function requestPermission(){
		try{
			await handle.requestPermission({ mode: "read" });
			isReady = true;
			getFilesFromHandle();
		} catch(e){};
	}
	async function open(){
    window.showDirectoryPicker().then(r=>{
      handle = r;
      getFilesFromHandle();
      storage.set("handle",r)
    })
	}

  const addFiles = async (files, shouldPlay = false)=>{
		
		const filesWithMeta = []

		for(let file of files){
			filesWithMeta.push({ file, id3: getId3(await file.getFile().then(f => readAsArrayBuffer(f)))});
		}
		
		for(let fileWithMeta of filesWithMeta){
			files.push(fileWithMeta);
		}
    setMediaList(filesWithMeta);
		playFile(filesWithMeta[0]);
    setcPlayer(i=>{return {...i,currentID:0}});
		
	}
  function updateDisplay({ file, id3 = {}}){
		
		setMusicData({
      title: id3["TIT2"] ?? file.name,
		  infoTitle: id3["TIT2"] ?? file.name,
		  infoAlbum: id3["TALB"] ?? "",
		  infoArtist: id3["TPE1"] ?? "",
		  infoYear: id3["TYER"] ?? "",
    })
		
		if(id3["APIC"]){
			const url = URL.createObjectURL(new Blob([id3["APIC"][0].data]));
			setMusicData(i=>{return {...i,albumArt:url}})
			//URL.revokeObjectURL(url);
		} else {
			setMusicData(i=>{return {...i,albumArt:''}})
		}
	}
  async function getFilesFromHandle(){
		addFiles(await collectAsyncIterableAsArray(filterAsyncIterable(handle.values(), f => 
			f.kind === "file" && (f.name.endsWith(".mp3") || f.name.endsWith(".m4a")
			))));
	}
  async function playFile({ file, id3 = {} }){
		const fileData = await file.getFile();
		updateDisplay({ file, id3 });
		const url =await URL.createObjectURL(fileData);
		setMusicData(i=>{return {...i,mf:url}})
		
    playerRef.current.src = url
    playerRef.current.play();
    setCP(file.name)
    setPlay(true);
		//togglePlay(true);
	}
  
const play = ()=>{
  setPlay(true);
  playerRef.current.play()
}
const pause = ()=>{
  setPlay(false);
  playerRef.current.pause()
}
  const PP =(x)=>{
    if (x.keyCode === 32) {
      if(PlayP){pause()}else{play()}
    }
  };
  const next=()=>{
    if(cPlayer.currentID+1<mediaList.length){
      playFile(mediaList[cPlayer.currentID+1]);
      setcPlayer((i)=>{return {...i,currentID:i.currentID+1}})
    }
    
  }
  const prev =()=>{
    if(cPlayer.currentID-1>-1){
      playFile(mediaList[cPlayer.currentID-1]);
      setcPlayer((i)=>{return {...i,currentID:i.currentID-1}})
    }
  }
  useEffect(()=>{
    fileLinks = new WeakMap();
     const aj=async ()=>{
      storage = new IdbStorage({ siloName: "file-handles" });
		  handle = await storage.get("handle");
      if(handle !=undefined){
        getFilesFromHandle();
      }
    }
    aj();
      const sw = new WcServiceWorker();
      document.addEventListener('keydown', PP);
    return ()=>{
      document.removeEventListener('keydown', PP);
    }

  },[])

  useEffect(()=>{
    if(playerRef.current!==undefined){
      playerRef.current.addEventListener("timeupdate", () => {
        if (!mouseDownOnSlider) {
          progressElRef.current.value = playerRef.current.currentTime / playerRef.current.duration * 100;
        }
      });

      playerRef.current.addEventListener("ended", () => {
        next();
      });
      progressElRef.current.addEventListener("change", () => {
        const pct = progressElRef.current.value / 100;
        playerRef.current.currentTime = (playerRef.current.duration || 0) * pct;
      });
      progressElRef.current.addEventListener("mousedown", () => {
        setmouseDownOnSlider(true);
      });
      progressElRef.current.addEventListener("mouseup", () => {
        setmouseDownOnSlider(false);
      });
    }
  },[mediaList])
  

  return (
    <>
    {mediaList.length>0?<div id="mainn" style={{backgroundImage:`url('${musicData?.albumArt?musicData?.albumArt:''}')`,backgroundRepeat:'no-repeat',backgroundSize:'cover'}}>
   <div className="row m-0 morphism" style={{minHeight:'100vh', backdropFilter:`blur(8px)`}}>
     <div className='col-11 col-md-6 col-lg-5 mx-auto'>
      <div className="py-3 d-block d-md-none">
        <i className="bi bi-three-dots border border-primary p-1 m-4 rounded-3 text-primary" onClick={()=>setPlayList(i=> !i)} />
      </div>
        <div className={`${playList?'d-none':'lh-1 py-1'}`}>
          <div className="container-fluid col-11 col-md-8 mx-auto">
            <div className>
              <img className="mx-auto d-block rounded-5" src={musicData?.albumArt} id="cover" width="100%" />
            </div>
            <div className="my-2">
              <div className="w-full px-1">
                <input type="range" ref={progressElRef} className="form-range" id="customRange1" defaultValue={0} min={0} max={100} step="0.5" />
              </div>
              <p id="title" className="display-6 fw-lighter" style={{fontSize: '1rem'}}>{musicData?.title}</p>
              <p id="artist" className="lead" >{musicData?.infoArtist}</p>
            </div>
            <div className="d-flex justify-content-center align-items-center gap-2 fw-bold">
              <button className="btn rounded-circle btn-outline-primary" onClick={prev}><i className="bi bi-chevron-left" /></button>
              <button className="btn rounded-circle btn-primary fs-4" onClick={()=>{PlayP?pause():play()}} id="pause"><i className={`bi ${PlayP?`bi-pause-fill`:`bi-caret-right`}`} /></button>
              <button className="btn rounded-circle btn-outline-primary" onClick={next}><i className="bi bi-chevron-right" /></button>
            </div>
          </div>
          <audio controls className="invisible" id="mp" ref={playerRef}>
            <source src={musicData?.mf?musicData?.mf:''} type="audio/mpeg" />
          </audio>
        </div>

      {mediaList.length>0?
      <div className={`${playList?'py-1':'d-none'}`}><TrackList setCP={setCP} setcPlayer={setcPlayer} cp={cp} playFile={playFile} mediaList={mediaList} /></div>
      :
      <div className="d-flex align-items-center flex-column" style={{minHeight:'100vh'}}>
        <p className="text-light c-f-primary fs-4">List Is Empty</p>
      </div>
      }
    </div>
    <div className='d-none d-md-block col-md-6 col-lg-7 mx-auto'>
      <TrackList setCP={setCP} setcPlayer={setcPlayer} cp={cp} playFile={playFile} mediaList={mediaList} />
    </div>
   </div>
  </div>:
  <DefUIStart open={open} />}
</>
  )
}

export function DefUIStart({open}){
  return(
    <div className="d-flex justify-content-center align-items-center flex-column" style={{minHeight:'100vh'}}>
      <button className="btn btn-outline-success rounded-5 fw-bold" onClick={open}>Start</button>
      <p className="text-light c-f-primary fs-4">Please Select Any Directory or Musics Files</p>
    </div>
  )
}

export function TrackList({mediaList,playFile,cp,setCP,setcPlayer}){
  return(
    <div className="d-flex flex-column col-12 overflow-auto hide-scrollbar" style={{minHeight:'100vh',maxHeight:'100vh'}}>
        {mediaList.map((i,iIndex)=>(
          <div key={iIndex} className="d-flex align-items-center border-bottom">
            <div>
              <i className={`bi bi-${cp===i.file.name?'caret-right text-primary':'file-music-fill'} fs-2`}></i>
            </div>
            <div>
              <p className={`c-f-primary fw-lighter text-break ${cp===i.file.name?'text-primary':''}`} onClick={()=>{playFile(i); setCP(i.file.name)}}>{i.file.name}</p>
            </div>
          </div>
        ))}
    </div>
  )
}
export default Home