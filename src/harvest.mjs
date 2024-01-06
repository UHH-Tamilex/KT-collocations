import Fs from 'fs';
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
                    words[n] = found[1].fromlemma;
            }
        }

        wordtotal = wordtotal + words.length;
        appendNgrams(words,2,twograms);
        appendNgrams(words,2,twograms,1);
        appendNgrams(words,1,onegrams);
    }

    const npmi = new Map();
    for(const [gram,freq] of twograms) {
        if(freq === 1) continue;
        const [xcount,ycount] = gram.split(' ').map(g => onegrams.get(g));
        if(xcount === 1 || ycount === 1) continue;
        const [px,py] = [xcount/wordtotal,ycount/wordtotal];
        const pxy = freq/wordtotal;
        npmi.set(gram, Math.log(pxy/(px * py)) / (0 - Math.log(pxy)));
        //npmi.set(gram, Math.log(pxy**2/(px * py)));
    }
    const nodes = [...onegrams].toSorted((a,b) => b[1] - a[1])
                               .map(c => {
                                 const found = index.find(e => e[1].islemma === c[0]);
                                 if(!found) return {id: c[0].trim(), size: c[1]};
                                 
                                 const features = found[1].features;
                                 for(const feature of features) {
                                    if(featureMap.has(feature))
                                        return {id: c[0].trim(), size: c[1], type: featureMap.get(feature)};
                                 }
                                 
                                 return {id: c[0].trim(), size: c[1]};
                                });
    /*
    const out2 = [...twograms].toSorted((a,b) => b[1] - a[1])
                             .map(c => `${c[0]},${c[1]}`)
                             .join('\n');
    */
    const links = [...npmi].toSorted((a,b) => b[1] - a[1])
                             .map(c => {
                                 const split = c[0].split(/\s+/);
                                 return {
                                    id: c[0],
                                    source: split[0],
                                    target: split[1],
                                    strength: c[1]
                                 };
                             });

    //Fs.writeFileSync('1grams.csv',out1);
    //Fs.writeFileSync('2grams.csv',out2);
    //Fs.writeFileSync('npmi.csv',out3);
    Fs.writeFileSync('collocations.json',JSON.stringify({nodes: nodes, links: links}));
};

const appendNgrams = (arr, n, collated,skip=0) => {
    n = parseInt(n);
    const grams = [];
    for(let i=0; i < arr.length - n - skip - 1; i++) {
        const sub = [];
        for(let j=i; j < i + n + (n-1)*skip; j = j + 1 + skip)
            sub.push(arr[j]);
        const gram = sub.join(' ');
        const inmap = collated.get(gram);
        if(inmap)
            collated.set(gram,inmap + 1);
        else
            collated.set(gram,1);
    }
};

go();
