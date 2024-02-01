import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';

import collocations from './collocations.json';

const colgraph = ForceGraph3D();

const focusNode = node => {
          // Aim at node from outside it
          const distance = 200;
          const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

          const newPos = node.x || node.y || node.z ? 
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }
            : { x: 0, y: 0, z: distance }; // special case if node is in (0,0,0)

          colgraph.cameraPosition(
            newPos, // new position
            node, // lookAt ({ x, y, z })
            1000  // ms transition duration
        );
};

const makeGraph = () => {
    const colours = new Map([
        ['adjective','#66c2a5'],
        ['noun','#fc8d62'],
        ['pronoun','#8da0cb'],
        ['verb','#e78ac3'],
        ['other','#a6d854']
    ]);
    const legend = document.getElementById('panellegend');
    legend.innerHTML = [...colours].map(c =>
        `<div><input type="checkbox" name="${c[0]}" checked autocomplete="off"/><label><span style="color:${c[1]}; font-size: 150%">●</span> ${c[0]}</div>`).join('') + '<div id="solonodes"><input type="checkbox" name="solonodes" checked autocomplete="off"/><label>Show unconnected nodes</label></div>';

    const newlinks = structuredClone(collocations.links).filter(l => l.strength >= 0.45);

    colgraph(document.getElementById('colgraph'))
        .graphData({nodes: collocations.nodes, links: newlinks})
        .nodeLabel(n => `${n.size} occurences`)
        .nodeThreeObject(n => {
            const sprite = new SpriteText(n.id);
            sprite.material.depthWrite = false;
            sprite.color = colours.get(n.type) || colours.get('other');
            sprite.textHeight = n.size/2 < 8 ? 8 : n.size/2;
            return sprite;
        })
        //.nodeVal(n => n.size/30)
        //.nodeAutoColorBy('type')
        .linkWidth(l => l.strength*5)
        .linkOpacity(0.3)
        .linkDirectionalArrowLength(5)
        .linkCurvature(l => l.curvature || 0)
        .linkLabel(l => `${l.citations.join(', ')} (NPMI: ${l.strength.toPrecision(4)})`)
        .onNodeClick(focusNode);
    

    colgraph.d3Force('link')
            .distance(l => 40/l.strength);

    const params = new URLSearchParams(window.location.search);
    if(params.get('demo') === 'true')
        demoMode();
};

const togglePanel = (e) => {
    const panel = document.getElementById('panel');
    if(panel.style.display !== 'flex') {
        panel.animate(
            [{ marginTop: '-25px'},{ marginTop: '0px'}],
            {duration: 200, iterations: 1}
        );

        panel.style.display = 'flex';
        e.target.textContent = '⇧';
    }
    else {
        panel.animate(
            [{ marginTop: '0px'},{ marginTop: '-25px'}],
            {duration: 200, iterations: 1}
        );
        setTimeout(() => panel.style.display = 'none',200);
        e.target.textContent = '⇩';
    }
};

const getConnected = (links) => {
    const ret = new Set();
    for(const link of links) {
        ret.add(link.source);
        ret.add(link.target);
    }
    return ret;
};

const updateGraph = () => {
    const colclone = {};
    colclone.nodes = collocations.nodes; // all nodes as graph objects
    colclone.links = structuredClone(collocations.links); // all original links

    const npmi = document.getElementById('npmi').value;
    colclone.links = colclone.links.filter(l => l.strength >= npmi);

    const inputs = document.getElementById('panellegend').querySelectorAll('input:not([name="solonodes"])');
    const checked = new Set([...inputs].filter(i => i.checked).map(i => i.getAttribute('name')));
    if(checked.size !== inputs.length) {
        colclone.nodes = colclone.nodes.filter(n => checked.has(n.type));
        const checkednodes = new Set(colclone.nodes.map(n => n.id));
        colclone.links = colclone.links.filter(l => checkednodes.has(l.target) && checkednodes.has(l.source));
    }

    if(!document.querySelector('input[name="solonodes"]').checked) {
        const connected = getConnected(colclone.links);
        colclone.nodes = colclone.nodes.filter(n => connected.has(n.id));
    }


    colgraph.graphData(colclone);
};

const demoMode = () => {
    let angle = 0;
    let focustimer = 0;
    let dist = 1400;
    const demoId = setInterval(() => {
        if(focustimer === 0 && Math.random() < 0.1) {
            const nodes = colgraph.graphData().nodes;
            const random = Math.floor(Math.random() * nodes.length);
            focustimer = 10;
            focusNode(nodes[random]);
            dist = 200;
        }
        else {
            if(focustimer > 0) focustimer = focustimer + 10;
            if(focustimer === 1300) focustimer = 0;
            colgraph.cameraPosition({
                x: dist * Math.sin(angle),
                z: dist * Math.cos(angle)
            });
            angle += Math.PI / 300;
        }
    }, 10);

    return demoId;
};

document.getElementById('paneltoggle').addEventListener('click',togglePanel);
document.getElementById('graphupdate').addEventListener('click',updateGraph);

makeGraph();
