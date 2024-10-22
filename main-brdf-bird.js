/*
Copyright (c) 2023 Wagyx Xygaw
Under MIT License
*/
import * as THREE from 'three';
import {
    TrackballControls
} from './js/TrackballControls.js';
import Stats from './js/libs/stats.module.js';


// MAIN

// standard global variables
let gContainer, gScene, gCamera, gRenderer, gControls, gStats;
// custom global variables
let gIntensityMesh, gInfoGui, gBRDF, gFrame, gSlidersFd, gVerticesMesh, gLightArrow, gReflectArrow;
const gcCamZ = {
    pos: [5, 5, 5],
    up: [0, 0, 1],
    target: [0, 0, 0]
};
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
const loaderContainer = document.querySelector('.loader-container');
activateLoadingAnimation();


const gParameters = {
    backgroundColor: "#333333",
    showIntensity: true,
    showFrame: true,
    logScale: false,
    thetaIn: 0,
    wavelength: 380,
    indWavelength: 0,
    uWavelength: { "0": 0 },
    indTheta_i: 0,
    uTheta_i: { "0": 0 },
    indPhi_i: 0,
    uPhi_i: { "0": 0 },
};

var resultCart2Sph = [0.0, 0.0, 0.0];

const infernoColors = [
    [25.13112622477341, -12.24266895238567, -23.07032500287172],
    [-71.31942824499214, 32.62606426397723, 73.20951985803202],
    [77.162935699427, -33.40235894210092, -81.80730925738993],
    [-41.70399613139459, 17.43639888205313, 44.35414519872813],
    [11.60249308247187, -3.972853965665698, -15.9423941062914],
    [0.1065134194856116, 0.5639564367884091, 3.932712388889277],
    [0.0002189403691192265, 0.001651004631001012, -0.01948089843709184]
];


init();
animate();

function sub2ind(i, j, w) {
    return j * w + i;
}

// FUNCTIONS 		
function init() {
    // SCENE
    gScene = new THREE.Scene();
    // CAMERA
    const width = window.innerWidth;
    const height = window.innerHeight;
    const viewAngle = 30;
    const near = 0.1;
    const far = 10000;
    gCamera = new THREE.PerspectiveCamera(viewAngle, width / height, near, far);
    gScene.add(gCamera);
    resetCamera();

    const light = new THREE.AmbientLight(0xffffff, 2.5);
    gScene.add(light);

    // RENDERER
    gRenderer = new THREE.WebGLRenderer({
        antialias: true
    });
    gRenderer.setPixelRatio(window.devicePixelRatio);
    gRenderer.setSize(window.innerWidth, window.innerHeight);

    gStats = new Stats();
    document.body.appendChild(gStats.dom);

    gContainer = document.getElementById('ThreeJS');
    gContainer.appendChild(gRenderer.domElement);

    // CONTROLS
    gControls = new TrackballControls(gCamera, gRenderer.domElement);
    gControls.noPan = true;
    gControls.rotateSpeed = 2.0;
    gControls.maxDistance = 10000.0;
    gControls.minDistance = 1.0;

    ////////////
    // CUSTOM //
    ////////////

    // initialize the geometry that represents the intensity
    {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(1 * 1 * 3, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(1 * 1 * 3, 3));
        const material = new THREE.MeshLambertMaterial({
            color: "#ffffff",
            side: THREE.DoubleSide,
            vertexColors: true,
        });
        gIntensityMesh = new THREE.Mesh(geometry, material);
        gScene.add(gIntensityMesh);
    }

    // adds spheres at the vertices
    {
        gVerticesMesh = makeVerticesMesh(100);
        gScene.add(gVerticesMesh);
    }

    // adds the elements of the reference frame
    gFrame = new THREE.Object3D();
    {
        const wireframe = makeWireframe();
        const material = new THREE.LineBasicMaterial( {
            color: 0xffffff,
            linewidth: 1,
        } );
        const line = new THREE.LineSegments(wireframe, material);
        gFrame.add(line);
        const line2 = new THREE.LineSegments(wireframe, material);
        line2.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        gFrame.add(line2);
        const line3 = new THREE.LineSegments(wireframe, material);
        line3.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        gFrame.add(line3);
    }

    gFrame.add(createArrow(new THREE.Vector3(0,0,0),new THREE.Vector3(1,0,0), 0xff0000));
    gFrame.add(createArrow(new THREE.Vector3(0,0,0),new THREE.Vector3(0,1,0), 0x0ff000));
    gFrame.add(createArrow(new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,1), 0x0000ff));

    gScene.add(gFrame);
    
    gReflectArrow = createArrow(new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,1), 0x000000)
    gScene.add(gReflectArrow);
    gLightArrow = createArrow(new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,1), 0xffff00)
    gScene.add(gLightArrow);

    /////////
    // GUI //
    /////////

    const gui = new dat.GUI({
        // width: 300,
    });
    const optionsFd = gui.addFolder("Options");


    optionsFd.add(gParameters, "showIntensity").name("Show Intensity").onChange(function (value) {
        gIntensityMesh.visible = gParameters.showIntensity;
    });
    optionsFd.add(gParameters, "showFrame").name("Show Frame").onChange(function (value) {
        gFrame.visible = gParameters.showFrame;
    });
    optionsFd.add(gParameters, "logScale").name("Log Scale").onChange(function (value) {
        const brdfSlice = getSlice(gParameters.indWavelength, gParameters.indTheta_i, gParameters.indPhi_i);
        updateIntensity(brdfSlice);
        gInfoGui.name(makeInfoHtml(gBRDF, brdfSlice));
    });

    gParameters.inputFileButton = "";
    optionsFd.add(gParameters, 'inputFileButton').name('<input type="file" id="fileInput">');
    optionsFd.open();

    gSlidersFd = gui.addFolder("Controls");
    gSlidersFd.add(gParameters, 'indWavelength', gParameters.uWavelength).name('Wavelengths In').onChange(function (value) {
        const brdfSlice = getSlice(gParameters.indWavelength, gParameters.indTheta_i, gParameters.indPhi_i);
        updateIntensity(brdfSlice);
    });
    gSlidersFd.add(gParameters, 'indTheta_i', gParameters.uTheta_i).name('Theta In').onChange(function (value) {
        const brdfSlice = getSlice(gParameters.indWavelength, gParameters.indTheta_i, gParameters.indPhi_i);
        updateIntensity(brdfSlice);
    });
    gSlidersFd.add(gParameters, 'indPhi_i', gParameters.uPhi_i).name('Phi In').onChange(function (value) {
        const brdfSlice = getSlice(gParameters.indWavelength, gParameters.indTheta_i, gParameters.indPhi_i);
        updateIntensity(brdfSlice);
    });
    gSlidersFd.open();

    const detailsFd = gui.addFolder("Information");
    gParameters.message = "Once the rayset is loaded, info will be displayed here.";
    gInfoGui = detailsFd.add(gParameters, "message").name("");
    gInfoGui.__li.children[0].children[0].style.width = "auto";
    detailsFd.open();

    gui.open();
    desactivateLoadingAnimation();
    const filename = "./data/phong.brdf";
    loadBRDFFile(filename);

    // INPUT FILES FROM USER
    const fileInputElement = document.getElementById('fileInput');
    fileInputElement.addEventListener('change', function (e) {
        const file = fileInputElement.files[0];
        (async () => {
            activateLoadingAnimation();
            const fileContent = await file.text();
            loadData(JSON.parse(fileContent));
            desactivateLoadingAnimation();
        })();
    });

    // EVENTS
    document.addEventListener("keydown", onDocumentKeyDown, false);
    window.addEventListener('resize', onWindowResize);

} // end of function init()

function makeVerticesMesh(nbMaxVertices) {
    const defaultColor = new THREE.Color(0,0,0);
    const vertexMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.5,
        metalness: 0.5,
        // envMap:gTextureEquirec,
        // visible: gParameters.verticesActive,
    });
    const vertexGeometry = new THREE.SphereGeometry(0.01, 12 * 3, 6 * 3);
    const verticesMesh = new THREE.InstancedMesh(vertexGeometry, vertexMaterial, nbMaxVertices);
    // for (let i = 0; i < nbMaxVertices; ++i) {
    //     verticesMesh.setColorAt(i, defaultColor);
    // }
    return verticesMesh
}

function doDispose(obj) {
    if (obj !== null) {
        for (let i = 0, l = obj.children.length; i < l; i++) {
            doDispose(obj.children[i]);
        }
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            if (obj.material.map) {
                obj.material.map.dispose();
            }
            obj.material.dispose();
        }
    }
};

function reinstantiateMeshes(num) {
    if (num > gVerticesMesh.count) {
        gScene.remove(gVerticesMesh);
        doDispose(gVerticesMesh);
        gVerticesMesh = makeVerticesMesh(num);
        gScene.add(gVerticesMesh);
    }
}

function genArrowTransform(p0,p1) {
    const defaultP0 = new THREE.Vector3(0,-1,0);
    const defaultP1 = new THREE.Vector3(0,1,0);
    const defaultDir = new THREE.Vector3().subVectors(defaultP1,defaultP0);
    const length = p1.distanceTo(p0)
    const defaultLength = defaultP1.distanceTo(defaultP0)
    const dir = new THREE.Vector3().subVectors(p1,p0);

    const q = new THREE.Quaternion().setFromUnitVectors( defaultDir.divideScalar(defaultLength), dir.divideScalar(length) );
    const s = length/defaultLength;
    const p = new THREE.Vector3().subVectors(new THREE.Vector3().addVectors(p1,p0).multiplyScalar(0.5), 
    new THREE.Vector3().addVectors(defaultP1,defaultP0).multiplyScalar(0.5));
    const M = new THREE.Matrix4().compose(p,q, new THREE.Vector3(s,s,s));
    return M;
}

function createArrow(p0,p1,color) {
    const arrow = new THREE.Object3D();
    const material = new THREE.MeshBasicMaterial({ color: color });
    const cylGeometry = new THREE.CylinderGeometry(0.01, 0.01, 2, 16);
    const cylMesh = new THREE.Mesh(cylGeometry, material);
    // cylMesh.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    arrow.add(cylMesh);
    
    const coneGeometry = new THREE.CylinderGeometry(0, 0.05, 0.1, 20, 32);
    const coneMesh = new THREE.Mesh(coneGeometry, material);
    coneMesh.translateY(1.05);
    // coneMesh.rotateOnAxis(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
    arrow.add(coneMesh);
    
    arrow.applyMatrix4(genArrowTransform(p0,p1));
    return arrow;
}

function makeWireframe() {
    const points = [];
    const nCircleRes = 4 * 20;
    const nCircles = 10;
    for (let i = 0; i < nCircles; ++i) {
        const r = (i + 1) / nCircles;
        for (let j = 0; j < nCircleRes; ++j) {
            const theta = j * 2 * Math.PI / nCircleRes;
            const theta2 = (j + 1) * 2 * Math.PI / nCircleRes;
            points.push(new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), 0));
            points.push(new THREE.Vector3(r * Math.cos(theta2), r * Math.sin(theta2), 0));
        }
    }
    const nLines = 36;
    for (let i = 0; i < nLines; ++i) {
        const theta = i * 2 * Math.PI / nLines;
        points.push(new THREE.Vector3(0, 0, 0));
        points.push(new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
}

function updateSliders() {
    const num = gSlidersFd.__controllers.length;
    for (let i = 0; i < num; ++i) {
        gSlidersFd.remove(gSlidersFd.__controllers[0]);
    }

    gSlidersFd.add(gParameters, 'indWavelength', gParameters.uWavelength).name('Wavelengths In').onChange(function (value) {
        const brdfSlice = getSlice(gParameters.indWavelength, gParameters.indTheta_i, gParameters.indPhi_i);
        updateIntensity(brdfSlice);
        gInfoGui.name(makeInfoHtml(gBRDF, brdfSlice));
    });
    gSlidersFd.add(gParameters, 'indTheta_i', gParameters.uTheta_i).name('Theta In').onChange(function (value) {
        const brdfSlice = getSlice(gParameters.indWavelength, gParameters.indTheta_i, gParameters.indPhi_i);
        updateIntensity(brdfSlice);
        gInfoGui.name(makeInfoHtml(gBRDF, brdfSlice));
    });
    gSlidersFd.add(gParameters, 'indPhi_i', gParameters.uPhi_i).name('Phi In').onChange(function (value) {
        const brdfSlice = getSlice(gParameters.indWavelength, gParameters.indTheta_i, gParameters.indPhi_i);
        updateIntensity(brdfSlice);
        gInfoGui.name(makeInfoHtml(gBRDF, brdfSlice));
    });
}

function radians(degrees) {
    return degrees * Math.PI / 180;
}



function updateIntensity(data) {
    const w = data.values.length;
    const h = data.values[0].length;
    const positions = new THREE.Float32BufferAttribute(h * w * 3, 3);
    // const normals = new THREE.Float32BufferAttribute(h * w * 3, 3);
    const colors = new THREE.Float32BufferAttribute(h * w * 3, 3);
    const logmin = Math.log10(data.minValNonZero);
    const logmax = Math.log10(data.maxVal);
    // console.log(data.minVal, data.maxVal, data.minValNonZero)
    gVerticesMesh.count = w*h;
    for (let i = 0; i < w; ++i) {
        for (let j = 0; j < h; ++j) {
            const ii = sub2ind(i, j, w);
            let val = data.values[i][j];
            if (gParameters.logScale && val > 0) {
                val = Math.max(data.minValNonZero, val);
                val = (Math.log10(val) - logmin) / (logmax - logmin);
            } else {
                val /= data.maxVal;
            }
            const pos = sph2cart(val, radians(data.theta_o[j]), radians(data.phi_o[i]));
            const col = cmapInferno(val).map(x=>Math.pow(x,2.2));
            positions.setXYZ(ii, pos[0], pos[1], pos[2]);
            const M = new THREE.Matrix4().makeTranslation(pos[0], pos[1], pos[2]);
            gVerticesMesh.setMatrixAt(ii,M);
            // normals.setXYZ(ii, pos[0], pos[1], pos[2]);
            colors.setXYZ(ii, col[0], col[1], col[2]);
        }
    }
    gVerticesMesh.instanceMatrix.needsUpdate = true;

    gIntensityMesh.geometry.dispose();
    gIntensityMesh.geometry = new THREE.BufferGeometry();
    gIntensityMesh.geometry.setAttribute('position', positions);
    gIntensityMesh.geometry.setAttribute('normal', positions);
    gIntensityMesh.geometry.setAttribute('color', colors);

    const indices = [];
    for (let j = 0; j < h - 1; ++j) {
        for (let i = 0; i < w; ++i) {
            const i1 = positiveModulo(i + 1, w);
            indices.push(sub2ind(i, j, w));
            indices.push(sub2ind(i1, j, w));
            indices.push(sub2ind(i, j + 1, w));
            indices.push(sub2ind(i1, j, w));
            indices.push(sub2ind(i1, j + 1, w));
            indices.push(sub2ind(i, j + 1, w));
        }
    }
    gIntensityMesh.geometry.setIndex(indices);
    // gIntensityMesh.geometry.computeBoundingSphere();
    // gIntensityMesh.geometry.computeVertexNormals();

    //move arrows
    {
        const p0 = new THREE.Vector3(0,0,0);
        let p1 = sph2cart(1,radians(data.theta_i),radians(data.phi_i));
        p1 = new THREE.Vector3(p1[0],p1[1],p1[2]);
        gLightArrow.matrix.identity();
        gLightArrow.matrixAutoUpdate=false;
        gLightArrow.applyMatrix4(genArrowTransform(p0,p1));
        
        p1 = sph2cart(1,radians(data.theta_i),radians(data.phi_i+180));
        p1 = new THREE.Vector3(p1[0],p1[1],p1[2]);
        gReflectArrow.matrix.identity();
        gReflectArrow.matrixAutoUpdate=false;
        gReflectArrow.applyMatrix4(genArrowTransform(p0,p1));
    }
}



function animate() {
    requestAnimationFrame(animate);
    render();
    update();
    gStats.update();
}

function update() {
    gControls.update();
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    gCamera.aspect = width / height;
    gCamera.updateProjectionMatrix();
    gRenderer.setSize(width, height);
}

function render() {
    gRenderer.setClearColor(gParameters.backgroundColor);
    gRenderer.render(gScene, gCamera);
}

function resetCamera() {
    gCamera.position.set(...gcCamZ.pos);
    gCamera.up.set(...gcCamZ.up);
    gCamera.lookAt(...gcCamZ.target);
}

function onDocumentKeyDown(event) {
    //https://www.freecodecamp.org/news/javascript-keycode-list-keypress-event-key-codes/
    const keyCode = event.which;
    if (keyCode == 53) {
        //mambo number 5
        resetCamera();
    }
};

function makeInfoHtml(brdf, brdfSlice) {
    if (brdf === undefined) {
        return "";
    }
    const message = [];
    if (gParameters.logScale) {
        message.push(...makeScale(brdfSlice.minValNonZero, brdfSlice.maxVal));
    }
    else {
        message.push(...makeScale(0, brdfSlice.maxVal));
    }
    message.push(...metadataToHTml(brdf.metadata));
    return message.join("");
}

function metadataToHTml(metadata,level = 0) {
    const message=[];
    for (const el of Object.keys(metadata)) {
        message.push("*".repeat(level) + " " + el + " : ")
        if (typeof metadata[el] === "object"){
            message.push("<br>");
            message.push(...metadataToHTml(metadata[el],level+1))
        } else{
            message.push(metadata[el]);
        }
        message.push("<br>");
    }
    return message;
}


function computeMinMax1D(array) {
    const result = { max: 1e-12, min: 1e12, minNonZero: 1e12 };
    for (let x of array) {
        if (isNaN(x)) continue;
        result.min = Math.min(result.min, x);
        result.max = Math.max(result.max, x);
        if (x > 0) {
            result.minNonZero = Math.min(result.minNonZero, x);
        }
    }
    return result;
}

function isClose(x, v) {
    return Math.abs(x - v) < 1e-4;
}

function getSlice(iw, iti, ipi) {
    const w = gBRDF.uWavelength[iw];
    const ti = gBRDF.uTheta_i[iti];
    const pi = gBRDF.uPhi_i[ipi];

    const brdfSlice = { values: [], theta_o: [...gBRDF.uTheta_o], phi_o: [...gBRDF.uPhi_o],
        theta_i:ti, phi_i:pi, wavelength:w};
    const indTo = {};
    for (let i = 0, l = brdfSlice.theta_o.length; i < l; ++i) {
        indTo[brdfSlice.theta_o[i]] = i;
    }
    const indPo = {};
    for (let i = 0, l = brdfSlice.phi_o.length; i < l; ++i) {
        indPo[brdfSlice.phi_o[i]] = i;
    }

    for (let po of brdfSlice.phi_o) {
        const tp = new Float32Array(brdfSlice.theta_o.length).fill(-1);
        brdfSlice.values.push(tp);
    }


    const points = { values: [], theta_o: [], phi_o: [] }
    for (let i = 0, l = gBRDF.data.BRDF.values.length; i < l; ++i) {
        if (isClose(gBRDF.data.wavelength_i.values[i], w) &&
            isClose(gBRDF.data.theta_i.values[i], ti) &&
            isClose(gBRDF.data.phi_i.values[i], pi)) {
            const val = gBRDF.data.BRDF.values[i]
            const to = gBRDF.data.theta_r.values[i];
            const po = gBRDF.data.phi_r.values[i];
            brdfSlice.values[indPo[po]][indTo[to]] = val;
            points.values.push(val);
        }
    }

    const res = computeMinMax1D(points.values);
    brdfSlice.minVal = res.min;
    brdfSlice.minValNonZero = res.minNonZero * 0.9;
    brdfSlice.maxVal = res.max;
    return brdfSlice;
}

function loadData(brdfData) {
    gBRDF = brdfData;
    gBRDF.uWavelength = new Float32Array([...new Set(brdfData.data.wavelength_i.values)]).sort();
    // console.log(gBRDF.uWavelength);
    gBRDF.uTheta_i = new Float32Array([...new Set(brdfData.data.theta_i.values)]).sort();
    // console.log(gBRDF.uTheta_i);
    gBRDF.uPhi_i = new Float32Array([...new Set(brdfData.data.phi_i.values)]).sort();
    // console.log(gBRDF.uPhi_i);
    gBRDF.uTheta_o = new Float32Array([...new Set(brdfData.data.theta_r.values)]).sort();
    // console.log(gBRDF.uTheta_o);
    gBRDF.uPhi_o = new Float32Array([...new Set(brdfData.data.phi_r.values)]).sort();
    // console.log(gBRDF.uPhi_o);

    gParameters.uWavelength = {};
    for (let i = 0, l = gBRDF.uWavelength.length; i < l; ++i) {
        gParameters.uWavelength[gBRDF.uWavelength[i]] = i;
    }
    gParameters.uTheta_i = {};
    for (let i = 0, l = gBRDF.uTheta_i.length; i < l; ++i) {
        gParameters.uTheta_i[gBRDF.uTheta_i[i]] = i;
    }
    gParameters.uPhi_i = {};
    for (let i = 0, l = gBRDF.uPhi_i.length; i < l; ++i) {
        gParameters.uPhi_i[gBRDF.uPhi_i[i]] = i;
    }

    const brdfSlice = getSlice(gParameters.indWavelength, gParameters.indTheta_i, gParameters.indPhi_i);
    reinstantiateMeshes(gBRDF.uTheta_o.length * gBRDF.uPhi_o.length)
    updateIntensity(brdfSlice);
    updateSliders();
    gInfoGui.name(makeInfoHtml(gBRDF, brdfSlice));

    
    desactivateLoadingAnimation();
}


function loadBRDFFile(filename) {
    activateLoadingAnimation();
    (async () => {
        const response = await fetch(filename);
        const data = await response.json();
        loadData(data);
        // loadStream(stream);
    })();
}


function arraySum(arr) {
    return arr.reduce((partialSum, a) => partialSum + a, 0);
}

function sph2cart(radius, inclination, azimuth) {
    resultCart2Sph[0] = radius * Math.sin(inclination) * Math.cos(azimuth);
    resultCart2Sph[1] = radius * Math.sin(inclination) * Math.sin(azimuth);
    resultCart2Sph[2] = radius * Math.cos(inclination);
    return resultCart2Sph;
}

function positiveModulo(a, n) {
    return ((a % n) + n) % n
}

function mapColor(t, colorsmap) {
    const res = [0.0, 0.0, 0.0];
    for (let j = 0, l = colorsmap.length; j < l; ++j) {
        for (let i = 0; i < 3; ++i) {
            res[i] = res[i] * t + colorsmap[j][i];
        }
    }
    return res;
}

function stringifyValue(value) {
    let res = value.toPrecision(3);
    if (value == 0) {
        res = "0";
    }
    return res;
}

function makeScale(minVal, maxVal) {
    const message = [];
    const minString = stringifyValue(minVal);
    const maxString = stringifyValue(maxVal);

    message.push("<b>Scale in sr^-1</b>");
    message.push("<table style=\"border:0px solid black; width:220px\">");
    message.push("<tr>");
    message.push("<td style=\"text-align: left; border:0px solid black;width:33%;\">" + minString + "</td>");
    message.push("<td style=\"text-align: right; border:0px solid black;width:33%;\">" + maxString + "</td>");
    message.push("</tr>");
    message.push("</table>");
    message.push(...makeColormapScale());
    message.push("<br>");
    return message;
}

function makeColormapScale() {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 15;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = id.data;
    let col;
    const cols = [];
    for (let x = 0; x < canvas.width; ++x) {
        col = cmapInferno(x / canvas.width);
        col[0] = clamp(Math.floor(col[0] * 256), 0, 255);
        col[1] = clamp(Math.floor(col[1] * 256), 0, 255)
        col[2] = clamp(Math.floor(col[2] * 256), 0, 255)
        cols.push(col);
    }
    let off;
    for (let y = 0; y < canvas.height; ++y) {
        for (let x = 0; x < canvas.width; ++x) {
            off = (y * canvas.width + x) * 4;
            pixels[off] = cols[x][0];
            pixels[off + 1] = cols[x][1];
            pixels[off + 2] = cols[x][2];
            pixels[off + 3] = 255;
        }
    }
    ctx.putImageData(id, 0, 0);
    const message = [];
    message.push("<td height=5 style=\"text-align: center; border:0px solid black\">" + "<img src = \"" + canvas.toDataURL("image/png") + "\">" + "</td>");
    return message;
}

function cmapInferno(t) {
    return mapColor(t, infernoColors);
}

function activateLoadingAnimation() {
    loaderContainer.style.display = 'flex';
    // loaderContainer.style.visibility= "visible";
    loaderContainer.style.opacity = "1";
}

function desactivateLoadingAnimation() {
    loaderContainer.style.display = 'none';
    // // loaderContainer.style.visibility= "hidden";
    loaderContainer.style.opacity = "0";
}