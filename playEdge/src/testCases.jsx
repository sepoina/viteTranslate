import { Fragment, useState } from 'react';
import {
  Translate,
  useTranslateLanguage,
  version,
} from '@sepoina/vitetranslate/react';

//
// Valore che al momento del build non esiste: serve a provare il template literal
// interpolato, che è il caso in cui il marcatore NON viene estratto.
//
const nome = 'Mario';

const testCases = [
  // ============================================================
  'Forme di chiamata',
  // ============================================================
  [
    'children marcati',
    <Translate>_%_children marcati_%_</Translate>,
    'children marcati',
    '<Translate>_%_children marcati_%_</Translate>',
  ],
  [
    'children in graffe',
    <Translate>{'_%_children in graffe_%_'}</Translate>,
    'children in graffe',
    "<Translate>{'_%_children in graffe_%_'}</Translate>",
  ],
  [
    't stringa',
    <Translate t={'_%_t stringa_%_'} />,
    't stringa',
    "<Translate t={'_%_t stringa_%_'} />",
  ],
  [
    't template literal',
    <Translate t={`_%_t template literal_%_`} />,
    't template literal',
    '<Translate t={`_%_t template literal_%_`} />',
  ],
  [
    't tupla [testo, arg]',
    <Translate t={['_%_tupla con %s_%_', 'un argomento']} />,
    'tupla con un argomento',
    "<Translate t={['_%_tupla con %s_%_', 'un argomento']} />",
  ],
  [
    't oggetto { t, a }',
    <Translate t={{ t: '_%_oggetto in t, %s_%_', a: ['con a'] }} />,
    'oggetto in t, con a',
    "<Translate t={{ t: '_%_oggetto in t, %s_%_', a: ['con a'] }} />",
  ],
  [
    'o oggetto { t, a }',
    <Translate o={{ t: '_%_oggetto in o, %s_%_', a: ['con a'] }} />,
    'oggetto in o, con a',
    "<Translate o={{ t: '_%_oggetto in o, %s_%_', a: ['con a'] }} />",
  ],
  [
    'o senza a',
    <Translate o={{ t: '_%_o senza a_%_' }} />,
    'o senza a',
    "<Translate o={{ t: '_%_o senza a_%_' }} />",
  ],
  [
    'o con a scalare',
    <Translate o={{ t: '_%_o con a scalare: %s_%_', a: 'fatto' }} />,
    'o con a scalare: fatto',
    "<Translate o={{ t: '_%_o con a scalare: %s_%_', a: 'fatto' }} />",
  ],
  [
    'o con una tupla',
    <Translate o={['_%_array passato in o_%_']} />,
    'array passato in o',
    "<Translate o={['_%_array passato in o_%_']} />",
  ],
  [
    'a scalare',
    <Translate t={'_%_Ciao %s_%_'} a={'Mondo'} />,
    'Ciao Mondo',
    "<Translate t={'_%_Ciao %s_%_'} a={'Mondo'} />",
  ],
  [
    'a numero',
    <Translate t={'_%_Hai %s messaggi_%_'} a={42} />,
    'Hai 42 messaggi',
    "<Translate t={'_%_Hai %s messaggi_%_'} a={42} />",
  ],
  [
    'a array',
    <Translate t={'_%_%s + %s_%_'} a={[1, 2]} />,
    '1 + 2',
    "<Translate t={'_%_%s + %s_%_'} a={[1, 2]} />",
  ],

  // ============================================================
  'Cosa diventa un marcatore, e cosa no',
  // ============================================================
  [
    'Marcatore vuoto',
    <Translate>_%__%_</Translate>,
    '(vuoto: chiave vera, testo "")',
    '<Translate>_%__%_</Translate>',
  ],
  [
    'Solo uno spazio',
    <Translate>_%_ _%_</Translate>,
    '(uno spazio, invisibile in HTML)',
    '<Translate>_%_ _%_</Translate>',
  ],
  [
    'Spazi attorno, dentro t',
    <Translate t={' _%_non estratto_%_ '} />,
    '‼️ _%_non estratto_%_ (nei children il trim c’è, in t no)',
    "<Translate t={' _%_non estratto_%_ '} />",
  ],
  [
    'Marcatori annidati',
    <Translate t={'_%_uno_%_ e _%_due_%_'} />,
    'uno_%_ e _%_due (una chiave sola + warning di build)',
    "<Translate t={'_%_uno_%_ e _%_due_%_'} />",
  ],
  [
    'Marcatore aperto a runtime',
    <Translate t={'_%_' + 'mai chiuso'} />,
    '‼️_%_mai chiuso (i delimitatori restano: non si chiude)',
    "<Translate t={'_%_' + 'mai chiuso'} />",
  ],
  [
    'Marcatore chiuso a runtime',
    <Translate t={'_%_' + 'chiuso a runtime' + '_%_'} />,
    '‼️chiuso a runtime (delimitatori tolti, ma nessuna chiave)',
    "<Translate t={'_%_' + 'chiuso a runtime' + '_%_'} />",
  ],
  [
    'Template con ${}',
    <Translate t={`_%_ciao ${nome}_%_`} />,
    '‼️ciao Mario (limite noto: usare %s)',
    '<Translate t={`_%_ciao ${nome}_%_`} />',
  ],
  [
    'Marcatore in mezzo',
    <Translate t={'prima _%_in mezzo_%_ dopo'} />,
    '‼️prima _%_in mezzo_%_ dopo',
    "<Translate t={'prima _%_in mezzo_%_ dopo'} />",
  ],

  // ============================================================
  'Interpolazione %s',
  // ============================================================
  [
    'Solo %s',
    <Translate t={['_%_%s_%_', 'solo']} />,
    'solo',
    "<Translate t={['_%_%s_%_', 'solo']} />",
  ],
  [
    '%s multipli (spread)',
    <Translate t={['_%_%s più %s fa %s_%_', 1, 2, 3]} />,
    '1 più 2 fa 3',
    "<Translate t={['_%_%s più %s fa %s_%_', 1, 2, 3]} />",
  ],
  [
    '%s multipli (array annidato)',
    <Translate t={['_%_%s più %s fa %s_%_', [1, 2, 3]]} />,
    '123 più ⁇ fa ⁇ (l’array è UN argomento solo)',
    "<Translate t={['_%_%s più %s fa %s_%_', [1, 2, 3]]} />",
  ],
  [
    '%s multipli (via a)',
    <Translate t={'_%_%s più %s fa %s_%_'} a={[1, 2, 3]} />,
    '1 più 2 fa 3',
    "<Translate t={'_%_%s più %s fa %s_%_'} a={[1, 2, 3]} />",
  ],
  [
    '%s consecutivi',
    <Translate t={['_%_%s%s%s_%_', 'a', 'b', 'c']} />,
    'abc',
    "<Translate t={['_%_%s%s%s_%_', 'a', 'b', 'c']} />",
  ],
  [
    '%s null in mezzo',
    <Translate t={['_%_%s-%s-%s_%_', 'a', null, 'c']} />,
    'a-⁇-c',
    "<Translate t={['_%_%s-%s-%s_%_', 'a', null, 'c']} />",
  ],
  [
    '%s extra ignorati',
    <Translate t={['_%_solo %s_%_', 'uno', 'due', 'tre']} />,
    'solo uno',
    "<Translate t={['_%_solo %s_%_', 'uno', 'due', 'tre']} />",
  ],
  [
    '%s in meno',
    <Translate t={['_%_%s e %s_%_', 'uno']} />,
    'uno e ⁇',
    "<Translate t={['_%_%s e %s_%_', 'uno']} />",
  ],
  [
    '%s zero',
    <Translate t={['_%_Zero: %s_%_', 0]} />,
    'Zero: 0',
    "<Translate t={['_%_Zero: %s_%_', 0]} />",
  ],
  [
    '%s stringa vuota',
    <Translate t={['_%_tra parentesi: (%s)_%_', '']} />,
    'tra parentesi: ()',
    "<Translate t={['_%_tra parentesi: (%s)_%_', '']} />",
  ],
  [
    '%s null',
    <Translate t={['_%_null: %s_%_', null]} />,
    'null: ⁇',
    "<Translate t={['_%_null: %s_%_', null]} />",
  ],
  [
    '%s senza argomenti',
    <Translate t={'_%_niente: %s_%_'} />,
    'niente: ⁇',
    "<Translate t={'_%_niente: %s_%_'} />",
  ],
  [
    'a array vuoto',
    <Translate t={'_%_Vuoto: %s_%_'} a={[]} />,
    'Vuoto: ⁇',
    "<Translate t={'_%_Vuoto: %s_%_'} a={[]} />",
  ],
  [
    'a false',
    <Translate t={'_%_Falso: %s_%_'} a={false} />,
    'Falso: ⁇ (false = "non passato")',
    "<Translate t={'_%_Falso: %s_%_'} a={false} />",
  ],
  [
    '%s letterale come dato',
    <Translate t={['_%_il testo %s è letterale_%_', '%s']} />,
    'il testo %s è letterale (unico modo di mostrare un %s)',
    "<Translate t={['_%_il testo %s è letterale_%_', '%s']} />",
  ],
  [
    '% non seguito da s',
    <Translate>_%_Sconto del 50% oggi, 100% sicuro_%_</Translate>,
    'Sconto del 50% oggi, 100% sicuro',
    '<Translate>_%_Sconto del 50% oggi, 100% sicuro_%_</Translate>',
  ],
  [
    '%s dentro una parola',
    <Translate>_%_Sconto 100%sicuro_%_</Translate>,
    'Sconto 100⁇icuro (trappola: %s attaccato al testo)',
    '<Translate>_%_Sconto 100%sicuro_%_</Translate>',
  ],

  // ============================================================
  'Argomenti che sono nodi React',
  // ============================================================
  [
    'Elemento come argomento',
    <Translate t={['_%_Ciao %s_%_', <b>Mario</b>]} />,
    <>
      Ciao <b>Mario</b> (grassetto reale, non "[object Object]")
    </>,
    "<Translate t={['_%_Ciao %s_%_', <b>Mario</b>]} />",
  ],
  [
    'Elemento dentro <b>',
    <Translate
      t={['_%_Firmato come <b>%s</b>_%_', <a href="#chi">Mario</a>]}
    />,
    <>
      Firmato come{' '}
      <b>
        <a href="#chi">Mario</a>
      </b>
    </>,
    `<Translate t={['_%_Firmato come <b>%s</b>_%_', <a href="#chi">Mario</a>]} />`,
  ],
  [
    'Elemento al posto del testo',
    <Translate t={<b>sono un elemento</b>} />,
    <>
      <b>sono un elemento</b> (reso com’è, nessun prefisso)
    </>,
    '<Translate t={<b>sono un elemento</b>} />',
  ],
  [
    'Elemento nel primo slot della tupla',
    <Translate t={[<b>errore</b>, 'x']} />,
    '🚫[badDom] (lì il testo è il testo: resta un errore)',
    "<Translate t={[<b>errore</b>, 'x']} />",
  ],

  // ============================================================
  'Dialetto HTML dentro il marcatore',
  // ============================================================
  [
    'b / i',
    <Translate t={'_%_Testo <b>in grassetto</b> e <i>corsivo</i>_%_'} />,
    <>
      Testo <b>in grassetto</b> e <i>corsivo</i>
    </>,
    "<Translate t={'_%_Testo <b>in grassetto</b> e <i>corsivo</i>_%_'} />",
  ],
  [
    '%s dentro <b>',
    <Translate t={['_%_<b>%s</b>_%_', 'bold']} />,
    <b>bold</b>,
    "<Translate t={['_%_<b>%s</b>_%_', 'bold']} />",
  ],
  [
    'br',
    <Translate t={'_%_riga uno<br>riga due_%_'} />,
    <>
      riga uno
      <br />
      riga due
    </>,
    "<Translate t={'_%_riga uno<br>riga due_%_'} />",
  ],
  [
    'Attributi scartati',
    <Translate
      t={'_%_<b class="x" title="y" onclick="boom()">solo grassetto</b>_%_'}
    />,
    <>
      <b>solo grassetto</b> (nessun attributo sopravvive)
    </>,
    `<Translate t={'_%_<b class="x" title="y" onclick="boom()">solo grassetto</b>_%_'} />`,
  ],
  [
    'Tag sconosciuto sciolto',
    <Translate t={'_%_<div>sciolto</div> e <span>anche</span>_%_'} />,
    'sciolto e anche',
    "<Translate t={'_%_<div>sciolto</div> e <span>anche</span>_%_'} />",
  ],
  [
    'script sciolto',
    <Translate t={'_%_<script>alert(1)</script>_%_'} />,
    'alert(1) come testo, niente esecuzione',
    "<Translate t={'_%_<script>alert(1)</script>_%_'} />",
  ],
  [
    'Tag lasciato aperto',
    <Translate t={'_%_<b>resta aperto_%_'} />,
    <>
      <b>resta aperto</b> (chiuso implicitamente a fine stringa)
    </>,
    "<Translate t={'_%_<b>resta aperto_%_'} />",
  ],
  [
    'Chiusura spaiata',
    <Translate t={'_%_testo </b> spaiato_%_'} />,
    'testo  spaiato (il tag spaiato si ignora)',
    "<Translate t={'_%_testo </b> spaiato_%_'} />",
  ],
  [
    'Commento HTML',
    <Translate t={'_%_prima<!-- nascosto -->dopo_%_'} />,
    'primadopo',
    "<Translate t={'_%_prima<!-- nascosto -->dopo_%_'} />",
  ],
  [
    'Entità',
    <Translate t={'_%_5 &lt; 10 &amp; 10 &gt; 5_%_'} />,
    '5 < 10 & 10 > 5',
    "<Translate t={'_%_5 &lt; 10 &amp; 10 &gt; 5_%_'} />",
  ],
  [
    'Entità che sembra un tag',
    <Translate t={'_%_&lt;b&gt;non grassetto&lt;/b&gt;_%_'} />,
    '<b>non grassetto</b> come testo, non in grassetto',
    "<Translate t={'_%_&lt;b&gt;non grassetto&lt;/b&gt;_%_'} />",
  ],
  [
    'Tag incrociati',
    <Translate t={'_%_<b>x <i>y</b> z</i>_%_'} />,
    <>
      <b>
        x <i>y</i>
      </b>{' '}
      z — divergenza nota dal browser, + warning di build
    </>,
    "<Translate t={'_%_<b>x <i>y</b> z</i>_%_'} />",
  ],
  [
    'Markup come JSX (rotto)',
    <Translate>
      _%_<marquee>boom</marquee>_%_
    </Translate>,
    '‼️_%_ — i "_%_" sono due JSXText separati: niente chiave, e marquee viene buttato',
    '<Translate>_%_<marquee>boom</marquee>_%_</Translate>',
  ],

  // ============================================================
  'Testo non marcato e skipMark',
  // ============================================================
  [
    'Non marcato',
    <Translate>Questa stringa è senza marcatori</Translate>,
    '‼️Questa stringa è senza marcatori',
    '<Translate>Questa stringa è senza marcatori</Translate>',
  ],
  [
    'Non marcato con accenti',
    <Translate>è già tutto pronto, è un'occasione</Translate>,
    "‼️è già tutto pronto, è un'occasione",
    "<Translate>è già tutto pronto, è un'occasione</Translate>",
  ],
  [
    'Non marcato + %s',
    <Translate t={'ordine numero %s'} a={7} />,
    '‼️ordine numero 7 (l’interpolazione funziona lo stesso)',
    "<Translate t={'ordine numero %s'} a={7} />",
  ],
  [
    'skipMark',
    <Translate t={'+39 02 1234567'} skipMark />,
    '+39 02 1234567 (nessun ‼️, nessun warning)',
    "<Translate t={'+39 02 1234567'} skipMark />",
  ],
  [
    'skipMark + %s',
    <Translate t={'ordine numero %s'} a={7} skipMark />,
    'ordine numero 7',
    "<Translate t={'ordine numero %s'} a={7} skipMark />",
  ],
  [
    'skipMark su testo marcato',
    <Translate t={'_%_skipMark qui non fa niente_%_'} skipMark />,
    'skipMark qui non fa niente (la prop è inerte, 🔸/🔹 restano)',
    "<Translate t={'_%_skipMark qui non fa niente_%_'} skipMark />",
  ],
  [
    'children misti',
    <Translate>testo {'ed espressione'}</Translate>,
    '‼️testo  (i children sono una tupla: il secondo diventa un argomento e sparisce)',
    "<Translate>testo {'ed espressione'}</Translate>",
  ],

  // ============================================================
  'Valori che testo non sono',
  // ============================================================
  [
    'Numero',
    <Translate t={42} />,
    '42 (dato di dominio, nessun ‼️)',
    '<Translate t={42} />',
  ],
  [
    'Zero',
    <Translate t={0} />,
    '0 (zero è un valore, non "niente")',
    '<Translate t={0} />',
  ],
  ['BigInt', <Translate t={10n} />, '10', '<Translate t={10n} />'],
  ['Stringa vuota', <Translate t="" />, '(vuoto)', '<Translate t="" />'],
  ['null', <Translate t={null} />, '(vuoto)', '<Translate t={null} />'],
  [
    'undefined',
    <Translate t={undefined} />,
    '(vuoto: undefined fa scattare il default della prop)',
    '<Translate t={undefined} />',
  ],
  ['Nessuna prop', <Translate />, '(vuoto)', '<Translate />'],
  ['o null', <Translate o={null} />, '(vuoto)', '<Translate o={null} />'],
  [
    'Oggetto senza t',
    <Translate t={{ foo: 'bar' }} />,
    '(vuoto + un console.error una volta sola)',
    "<Translate t={{ foo: 'bar' }} />",
  ],
  [
    'Oggetto { t: null }',
    <Translate t={{ t: null }} />,
    '(vuoto: forma { t, a } valida, testo assente)',
    '<Translate t={{ t: null }} />',
  ],
  [
    'true',
    <Translate t={true} />,
    '🚫[true] (niente da salvare: si dice cosa c’era)',
    '<Translate t={true} />',
  ],
  ['Array vuoto', <Translate t={[]} />, '🚫[array]', '<Translate t={[]} />'],
  [
    'Tupla che porta solo null',
    <Translate t={[null]} />,
    '🚫[nullArray] (la tupla c’è, il posto del testo è vuoto)',
    '<Translate t={[null]} />',
  ],
  [
    'Funzione',
    <Translate t={() => 'x'} />,
    '🚫[func]',
    "<Translate t={() => 'x'} />",
  ],
  [
    'Symbol',
    <Translate t={Symbol('x')} />,
    '🚫[symbol]',
    "<Translate t={Symbol('x')} />",
  ],

  // ============================================================
  'Prop incompatibili: il testo non si perde più',
  // ============================================================
  [
    'o + t',
    <Translate o={{ t: '_%_vince oggetto_%_' }} t={'_%_t_%_'} />,
    '‼️vince oggetto (o è il canale esplicito)',
    "<Translate o={{ t: '_%_vince oggetto_%_' }} t={'_%_t_%_'} />",
  ],
  [
    'o + children',
    <Translate o={{ t: '_%_o vince su children_%_' }}>
      _%_children_%_
    </Translate>,
    '‼️o vince su children',
    "<Translate o={{ t: '_%_o vince su children_%_' }}>_%_children_%_</Translate>",
  ],
  [
    't + children',
    <Translate t={'_%_vince t_%_'}>_%_children_%_</Translate>,
    '‼️vince t',
    "<Translate t={'_%_vince t_%_'}>_%_children_%_</Translate>",
  ],
  [
    'tupla + a',
    <Translate t={['_%_%s_%_', 'vince la tupla']} a={['y']} />,
    '‼️vince la tupla',
    "<Translate t={['_%_%s_%_', 'vince la tupla']} a={['y']} />",
  ],
  [
    't="" + children',
    <Translate t="">_%_i children non spariscono_%_</Translate>,
    '‼️i children non spariscono (la stringa vuota non conta come testo)',
    '<Translate t="">_%_i children non spariscono_%_</Translate>',
  ],
  [
    't + children, nessuno dei due è testo',
    <Translate t={<b>a</b>}>{<i>b</i>}</Translate>,
    '🚫[badDom] (prop incompatibili E niente da salvare)',
    '<Translate t={<b>a</b>}>{<i>b</i>}</Translate>',
  ],

  // ============================================================
  'Testi veri',
  // ============================================================
  [
    'Accenti marcati',
    <Translate>_%_Perché è già un'occasione? À È Ì Ò Ù à è ì ò ù_%_</Translate>,
    "Perché è già un'occasione? À È Ì Ò Ù à è ì ò ù",
    "<Translate>_%_Perché è già un'occasione? À È Ì Ò Ù à è ì ò ù_%_</Translate>",
  ],
  [
    'Accenti + %s',
    <Translate t={['_%_Ciao %s, come stai?_%_', 'Già']} />,
    'Ciao Già, come stai?',
    "<Translate t={['_%_Ciao %s, come stai?_%_', 'Già']} />",
  ],
  [
    'Emoji',
    <Translate>_%_Benvenuto 👋 🚀_%_</Translate>,
    'Benvenuto 👋 🚀',
    '<Translate>_%_Benvenuto 👋 🚀_%_</Translate>',
  ],
  [
    'Cirillico / greco / CJK',
    <Translate>_%_Привет · Γειά σου · 你好 · こんにちは_%_</Translate>,
    'Привет · Γειά σου · 你好 · こんにちは',
    '<Translate>_%_Привет · Γειά σου · 你好 · こんにちは_%_</Translate>',
  ],
  [
    'Virgolette e backslash',
    <Translate t={'_%_"virgolette", \'apici\' e \\ backslash_%_'} />,
    '"virgolette", \'apici\' e \\ backslash',
    `<Translate t={'_%_"virgolette", \\'apici\\' e \\\\ backslash_%_'} />`,
  ],
  [
    'Nuova riga',
    <Translate t={'_%_riga 1\nriga 2_%_'} />,
    'riga 1 riga 2 su una riga sola: l’a-capo lo mangia l’HTML, serve <br>',
    "<Translate t={'_%_riga 1\\nriga 2_%_'} />",
  ],
  [
    'Testo lungo su più righe',
    <Translate>
      _%_Questo è un testo molto lungo che si ripete: ripeti ripeti ripeti
      ripeti ripeti ripeti ripeti ripeti ripeti ripeti ripeti ripeti ripeti
      ripeti ripeti ripeti._%_
    </Translate>,
    'Il testo, mandato a capo dal browser. Ma la chiave nel file di lingua si porta dentro gli a-capo e i rientri del sorgente.',
    `<Translate>
_%_Questo è un testo molto lungo che si ripete: ripeti
ripeti ripeti ripeti ripeti ripeti ripeti ripeti ripeti
ripeti ripeti ripeti ripeti ripeti ripeti ripeti._%_
</Translate>`,
  ],
];

export default testCases;