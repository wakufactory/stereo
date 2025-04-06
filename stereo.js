window.addEventListener("load",()=> {

	function isVisionPro() {	//とりあえず。もっとましな判定方法はないものか・・・・
		return navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints==5 
	}
	const afscene = `	<a-scene embedded background="color:#222" isMobile="false" xr-mode-ui="enabled: false" webxr="referenceSpaceType:local" >
	<a-assets></a-assets>

	<a-entity stereoimg position="0 0 -5"  rotation="0 0 0"  scale="1 1 1" grabbable="distance:1">
	<a-plane  width="5" position="0 0 0" eye="r"  material="shader:stereoflat;lr:1" ></a-plane>
	<a-plane  width="5" position="0 0 0" eye="l" material="shader:stereoflat;lr:0" ></a-plane>
	</a-entity>			
	<a-entity position="0 0 0">
		<a-camera></a-camera>
		<a-entity oculus-touch-controls="hand: left; model:false"  exitvr ></a-entity>
		<a-entity oculus-touch-controls="hand: right; model:false"  exitvr ></a-entity>
	</a-entity>
	</a-scene>`
	const af = document.createElement("div")
	af.innerHTML = afscene 
	document.body.appendChild(af)
	document.querySelectorAll(".fs").forEach(o=>{
		if(isVisionPro() && o.getAttribute("data-heic")) o.src = o.getAttribute("data-heic")
		o.addEventListener("click",ev=>{
			ev.target.requestFullscreen?ev.target.requestFullscreen():ev.target.webkitRequestFullscreen()
		})
	})
	const base = document.querySelector("[stereoimg]")
	const styleSheet = document.styleSheets[document.styleSheets.length-1]
	// WebXRのサポートを確認
	if (navigator.xr && navigator.xr.isSessionSupported) {
		navigator.xr.isSessionSupported('immersive-vr').then((vrSupported) => {
			if (vrSupported) {
				styleSheet.insertRule('.vr-btn { display: inline-block; }', styleSheet.cssRules.length);
			}
		});
		navigator.xr.isSessionSupported('immersive-ar').then((arSupported) => {
			if (arSupported) {
				styleSheet.insertRule('.ar-btn { display: inline-block; }', styleSheet.cssRules.length);
			}
		});
	}
	let id = 1
	document.querySelectorAll(".vr-btn,.ar-btn").forEach(o=>{
		const isVR = o.classList.contains("vr-btn")
		let pos 

		o.addEventListener('click',() => {
			pos = [window.scrollX,window.scrollY]
			const width = o.getAttribute("data-width")
			const depth = o.getAttribute("data-depth")
			base.components.stereoimg.setimg(o.getAttribute("data-src"),"st"+id++,parseFloat(width)>0?width:5,parseFloat(depth)>0?depth:5 )
			
			// VRモードを開始
			const scene = document.querySelector('a-scene');
			isVR?scene.enterVR():scene.enterAR();
		
			scene.addEventListener('exit-vr', () => {
				console.log("vrend")
				window.scrollTo(...pos)
			});
		});
	})
})
AFRAME.registerComponent('stereoimg', {
	schema: {
		query:{type:"array"}
	},
	init:async function() {
		console.log("start")
		this.imgs = this.el.querySelectorAll("a-plane")
		this.cam = document.querySelector("[camera]").object3D
		this.camy = 0
		this.base = this.el 
	},
	setimg:function(src,id,width=5,depth=5) {
		this.depth = depth 
		return new Promise((resolve,reject)=>{
		console.log(src)
			const assets = document.querySelector("a-assets")
			const im1 = document.createElement("img")
			im1.id = id
			im1.setAttribute("crossorigin","anonymous")
			this.imgs[0].setAttribute("material","src","")
			this.imgs[1].setAttribute("material","src","")
			this.imgs[0].setAttribute("width",width)
			this.imgs[1].setAttribute("width",width)
			im1.onload = ()=>{
				const as=(im1.height/im1.width*2)
				const h=this.imgs[0].getAttribute("width")*as
				this.imgs[0].setAttribute("height",h)
				this.imgs[0].setAttribute("material","src","#"+id)
				this.imgs[1].setAttribute("height",h)
				this.imgs[1].setAttribute("material","src","#"+id)
				resolve(im1)
			}
			im1.src = src
			assets.appendChild(im1) 			
		})
	},
	tick:function(time,dur) {
			if( 0!=this.cam.position.y) {
//				POXA.log(cam.position.y)
				this.base.object3D.position.set(this.cam.position.x,this.cam.position.y,this.cam.position.z-this.depth)
				this.camy = this.cam.position.y 
			}
	}
})

AFRAME.registerComponent('eye',{
	schema: {
		default:""
	},
	dependencies: ['camera'],
	init:function() {
		if(!this.el.sceneEl.dataset.stereoEye) {	//シングルトンでイベント設定
			this.el.sceneEl.dataset.stereoEye = true 
			this.cam = document.querySelector("[camera]")
			if(this.el.sceneEl.is('vr-mode')) {
				this.cam.object3DMap.camera.layers.disable(1) 
				this.cam.object3DMap.camera.layers.disable(2) 
			} else {
				this.cam.object3DMap.camera.layers.enable(1) 
				this.cam.object3DMap.camera.layers.enable(2) 					
			}
			this.el.sceneEl.addEventListener("enter-vr", ev=>{ 
				this.cam.object3DMap.camera.layers.disable(1) 
				this.cam.object3DMap.camera.layers.disable(2) 
			})
			this.el.sceneEl.addEventListener("exit-vr", ev=>{ 
				this.cam.object3DMap.camera.layers.enable(1) 
				this.cam.object3DMap.camera.layers.enable(2) 
			})
		}
	},
	update:function(old) {
		if(this.el.object3DMap?.mesh)
			this.el.object3DMap.mesh.layers.set(this.data==""?0:(this.data=="l"?1:2))
	}
})
AFRAME.registerComponent('exitvr', {
	init:function() {
		this.el.addEventListener('bbuttonup',this.exitvr)
		this.el.addEventListener('ybuttonup',this.exitvr)			
	},
	exitvr:function() {
		AFRAME.scenes[0].exitVR()
	}
})
AFRAME.registerShader('stereoflat',{
	schema:{
		src:{type:'map',is:'uniform'},
		lr:{type:'int',is:'uniform'}
	},
	row:false,
	vertexShader:`
out vec2 vuv ;
out vec3 vpos ;
uniform int lr;

const float PI = 3.141592654 ;
void main() {
	vuv = uv;
	vuv.x=(lr==0)?vuv.x/2.:vuv.x/2.+.5;
	vec3 tpos = position ;
	vpos = (modelMatrix * vec4( tpos,1.0)).xyz ;
	gl_Position = projectionMatrix * modelViewMatrix * vec4( tpos, 1.0 );
}
`,
	fragmentShader:`
	precision highp float;
	in vec2 vuv ;
	in vec3 vpos ;
	uniform sampler2D src ;
	void main () {
		vec4 color = texture(src,vuv) ;
		gl_FragColor = vec4(color);
	}
`
})