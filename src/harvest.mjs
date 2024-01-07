import Fs from 'fs';
import Path from 'path';
import Jsdom from 'jsdom';

const featureMap = new Map([
    ['adj.','adjective'],
    ['v.r.','verb'],
    ['v.','verb'],
    ['p.n.','noun'],
    ['r.n.','noun'],
    ['n.','noun'],
    ['m.','noun'],
    ['f.','noun'],
    ['dem.pron.','pronoun'],
    ['inter.pron.','pronoun'],
    ['pers.pron.','pronoun']
]);
const dir = '../../corpus/Kuruntokai';
const go = () => {
    Fs.readdir(dir,(err,files) => {
        if(err) return console.log(err);
        const flist = [];
        files.forEach(f => {
            if(/^KT.+\.xml$/.test(f))
                flist.push(dir + '/' + f);
        });
        readfiles(flist);
    });
};

const readfiles = arr => {
    const index = JSON.parse(Fs.readFileSync('index.json',{encoding: 'utf8'}));
    const onegrams = new Map();
    const twograms = new Map();
    let wordtotal = 0;

    for(const fname of arr) {
        const str = Fs.readFileSync(fname,{encoding: 'utf-8'});
        const poemnum = Path.basename(fname,'.xml');
        const dom = new Jsdom.JSDOM('');
        const parser = new dom.window.DOMParser();
        const doc = parser.parseFromString(str,'text/xml');
        const words = [...doc.querySelectorAll('standOff[type="wordsplit"] > entry')].map(el => {
            const simple = el.querySelector('form[type="simple"]');
            if(simple) return simple.textContent.replaceAll(/[*’]/g,'u').split('-');
            const form = el.querySelector('form').cloneNode(true);
            for(const pc of form.querySelectorAll('pc, note')) pc.remove();
            return form.textContent.replace(/-um$/,'').replaceAll(/[*’]/g,'u').split('-');
        }).flat().filter(f => f !== '');
        
        const findfn = (word) => index.find(e => e[0] === word);
        for(let n=0;n<words.length;n++) {
            const found = findfn(words[n]);
            //const found = index.find(e => e[0] === words[n]);
            if(found) {
                if(found[1].fromlemma && found[1].fromlemma !== '')
                    words[n] = found[1].fromlemma.trim();
            }
        }

        wordtotal = wordtotal + words.length;
        appendNgrams(words,2,twograms,0,poemnum);
        appendNgrams(words,2,twograms,1,poemnum);
        appendNgrams(words,1,onegrams,0,poemnum);
    }

    const npmi = new Map();
    for(const [gram,obj] of twograms) {
        const freq = obj.count;
        if(freq === 1) continue; // include hapaxes?
        const [xcount,ycount] = gram.split(' ').map(g => onegrams.get(g).count);
        //if(xcount === 1 || ycount === 1) continue; // include hapaxes?
        const [px,py] = [xcount/wordtotal,ycount/wordtotal];
        const pxy = freq/wordtotal;
        npmi.set(gram, Math.log(pxy/(px * py)) / (-Math.log(pxy)));
        //npmi.set(gram, Math.log(pxy**2/(px * py)));
    }
    const nodes = [...onegrams].toSorted((a,b) => b[1] > a[1] ? -1 : 1)
                               .map(c => {
                                 const found = index.find(e => e[1].islemma === c[0]);
                                 if(!found) return {id: c[0], size: c[1].count};
                                 
                                 const features = found[1].features;
                                 for(const feature of features) {
                                    if(featureMap.has(feature))
                                        return {id: c[0], size: c[1].count, type: featureMap.get(feature)};
                                 }
                                 
                                 return {id: c[0], size: c[1].count};
                                });
    /*
    const out2 = [...twograms].toSorted((a,b) => b[1] - a[1])
                             .map(c => `${c[0]},${c[1]}`)
                             .join('\n');
    */
    const links = [...npmi].toSorted((a,b) => b[1] > a[1] ? -1 : 1)
                           .map(c => {
                                 const split = c[0].split(/\s+/);
                                 const ret = {
                                    id: c[0],
                                    source: split[0],
                                    target: split[1],
                                    strength: c[1],
                                    citations: [...twograms.get(c[0]).citations].toSorted((a,b) => a.replaceAll(/\D/g,'') < b.replaceAll(/\D/g,'') ? -1 : 1)
                                 };
                                 if(split[0] === split[1])
                                     ret.curvature = 0.5;
                                 else if(npmi.has(`${split[1]} ${split[0]}`))
                                     ret.curvature = 0.25;
                                 return ret;
                             });

    //Fs.writeFileSync('1grams.csv',out1);
    //Fs.writeFileSync('2grams.csv',out2);
    //Fs.writeFileSync('npmi.csv',out3);
    Fs.writeFileSync('collocations.json',JSON.stringify({nodes: nodes, links: links}));
    console.log(`nodes: ${nodes.length}`);
    console.log(`links: ${links.length}`);
};

const appendNgrams = (arr, n, collated, skip, poemnum) => {
    n = parseInt(n);
    const grams = [];
    for(let i=0; i < arr.length - n - skip - 1; i++) {
        const sub = [];
        for(let j=i; j < i + n + (n-1)*skip; j = j + 1 + skip)
            sub.push(arr[j]);
        const gram = sub.join(' ');
        const inmap = collated.get(gram);
        if(inmap) {
            inmap.count = inmap.count + 1;
            inmap.citations.add(poemnum);
        }
        else
            collated.set(gram,{count: 1, citations: new Set([poemnum])});
    }
};

go();
