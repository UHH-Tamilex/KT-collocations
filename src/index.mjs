import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';

import collocations from './collocations.json';

const colgraph = ForceGraph3D();

collocations.links = collocations.links.filter(l => l.strength > 0.45);

colgraph(document.getElementById('colgraph'))
    .graphData(collocations)
    //.nodeLabel(n => n.id)
    .nodeThreeObject(n => {
        const sprite = new SpriteText(n.id);
        sprite.material.depthWrite = false;
        sprite.color = n.color;
        sprite.textHeight = n.size/2 < 8 ? 8 : n.size/2;
        return sprite;
    })
    //.nodeVal(n => n.size/30)
    .nodeAutoColorBy('type')
    .linkWidth(l => l.strength*5)
    .linkOpacity(0.3)
    .linkDirectionalArrowLength(5);

