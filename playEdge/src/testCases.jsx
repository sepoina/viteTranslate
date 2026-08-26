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
  '_%_Forme di chiamata_%_',
  // ============================================================
  [
    '_%_children marcati_%_',
    <Translate>_%_children marcati_%_</Translate>,
    'children marcati',
    '<Translate>_%_children marcati_%_</Translate>',
  ],
  [
    '_%_children in graffe_%_',
    <Translate>{'_%_children in graffe_%_'}</Translate>,
    'children in graffe',
    "<Translate>{'_%_children in graffe_%_'}</Translate>",
  ],
  [
    '_%_t stringa_%_',
    <Translate t={'_%_t stringa_%_'} />,
    't stringa',
    "<Translate t={'_%_t stringa_%_'} />",
  ],
  [
    '_%_t template literal_%_',
    <Translate t={`_%_t template literal_%_`} />,
    't template literal',
    '<Translate t={`_%_t template literal_%_`} />',
  ],
  [
    '_%_t tupla [testo, arg]_%_',
    <Translate t={['_%_tupla con %s_%_', 'un argomento']} />,
    'tupla con un argomento',
    "<Translate t={['_%_tupla con %s_%_', 'un argomento']} />",
  ],
  [
    '_%_t oggetto { t, a }_%_',
    <Translate t={{ t: '_%_oggetto in t, %s_%_', a: ['con a'] }} />,
    'oggetto in t, con a',
    "<Translate t={{ t: '_%_oggetto in t, %s_%_', a: ['con a'] }} />",
  ],
  [
    '_%_o oggetto { t, a }_%_',
    <Translate o={{ t: '_%_oggetto in o, %s_%_', a: ['con a'] }} />,
    'oggetto in o, con a',
    "<Translate o={{ t: '_%_oggetto in o, %s_%_', a: ['con a'] }} />",
  ],
  [
    '_%_o senza a_%_',
    <Translate o={{ t: '_%_o senza a_%_' }} />,
    'o senza a',
    "<Translate o={{ t: '_%_o senza a_%_' }} />",
  ],
  [
    '_%_o con a scalare_%_',
    <Translate o={{ t: '_%_o con a scalare: %s_%_', a: 'fatto' }} />,
    'o con a scalare: fatto',
    "<Translate o={{ t: '_%_o con a scalare: %s_%_', a: 'fatto' }} />",
  ],
  [
    '_%_o con una tupla_%_',
    <Translate o={['_%_array passato in o_%_']} />,
    'array passato in o',
    "<Translate o={['_%_array passato in o_%_']} />",
  ],
  [
    '_%_a scalare_%_',
    <Translate t={'_%_Ciao %s_%_'} a={'Mondo'} />,
    'Ciao Mondo',
    "<Translate t={'_%_Ciao %s_%_'} a={'Mondo'} />",
  ],
  [
    '_%_a numero_%_',
    <Translate t={'_%_Hai %s messaggi_%_'} a={42} />,
    'Hai 42 messaggi',
    "<Translate t={'_%_Hai %s messaggi_%_'} a={42} />",
  ],
  [
    '_%_a array_%_',
    <Translate t={'_%_%s + %s_%_'} a={[1, 2]} />,
    '1 + 2',
    "<Translate t={'_%_%s + %s_%_'} a={[1, 2]} />",
  ],

  // ============================================================
  '_%_Cosa diventa un marcatore, e cosa no_%_',
  // ============================================================
  [
    '_%_Marcatore vuoto_%_',
    <Translate>_%__%_</Translate>,
    '(vuoto: chiave vera, testo "")',
    '<Translate>_%__%_</Translate>',
  ],
  [
    '_%_Solo uno spazio_%_',
    <Translate>_%_ _%_</Translate>,
    '(uno spazio, invisibile in HTML)',
    '<Translate>_%_ _%_</Translate>',
  ],
  [
    '_%_Spazi attorno, dentro t_%_',
    <Translate t={' _%_non estratto_%_ '} />,
    '‼️ _%_non estratto_%_ (nei children il trim c’è, in t no)',
    "<Translate t={' _%_non estratto_%_ '} />",
  ],
  [
    '_%_Marcatori annidati_%_',
    <Translate t={'_%_uno_%_ e _%_due_%_'} />,
    'uno_%_ e _%_due (una chiave sola + warning di build)',
    "<Translate t={'_%_uno_%_ e _%_due_%_'} />",
  ],
  [
    '_%_Marcatore aperto a runtime_%_',
    <Translate t={'_%_' + 'mai chiuso'} />,
    '‼️_%_mai chiuso (i delimitatori restano: non si chiude)',
    "<Translate t={'_%_' + 'mai chiuso'} />",
  ],
  [
    '_%_Marcatore chiuso a runtime_%_',
    <Translate t={'_%_' + 'chiuso a runtime' + '_%_'} />,
    '‼️chiuso a runtime (delimitatori tolti, ma nessuna chiave)',
    "<Translate t={'_%_' + 'chiuso a runtime' + '_%_'} />",
  ],
  [
    '_%_Template con ${}_%_',
    <Translate t={`_%_ciao ${nome}_%_`} />,
    '‼️ciao Mario (limite noto: usare %s)',
    '<Translate t={`_%_ciao ${nome}_%_`} />',
  ],
  [
    '_%_Marcatore in mezzo_%_',
    <Translate t={'prima _%_in mezzo_%_ dopo'} />,
    '‼️prima _%_in mezzo_%_ dopo',
    "<Translate t={'prima _%_in mezzo_%_ dopo'} />",
  ],

  // ============================================================
  '_%_Interpolazione %s_%_',
  // ============================================================
  [
    '_%_Solo %s_%_',
    <Translate t={['_%_%s_%_', 'solo']} />,
    'solo',
    "<Translate t={['_%_%s_%_', 'solo']} />",
  ],
  [
    '_%_%s multipli (spread)_%_',
    <Translate t={['_%_%s più %s fa %s_%_', 1, 2, 3]} />,
    '1 più 2 fa 3',
    "<Translate t={['_%_%s più %s fa %s_%_', 1, 2, 3]} />",
  ],
  [
    '_%_%s multipli (array annidato)_%_',
    <Translate t={['_%_%s più %s fa %s_%_', [1, 2, 3]]} />,
    '123 più ⁇ fa ⁇ (l’array è UN argomento solo)',
    "<Translate t={['_%_%s più %s fa %s_%_', [1, 2, 3]]} />",
  ],
  [
    '_%_%s multipli (via a)_%_',
    <Translate t={'_%_%s più %s fa %s_%_'} a={[1, 2, 3]} />,
    '1 più 2 fa 3',
    "<Translate t={'_%_%s più %s fa %s_%_'} a={[1, 2, 3]} />",
  ],
  [
    '_%_%s consecutivi_%_',
    <Translate t={['_%_%s%s%s_%_', 'a', 'b', 'c']} />,
    'abc',
    "<Translate t={['_%_%s%s%s_%_', 'a', 'b', 'c']} />",
  ],
  [
    '_%_%s null in mezzo_%_',
    <Translate t={['_%_%s-%s-%s_%_', 'a', null, 'c']} />,
    'a-⁇-c',
    "<Translate t={['_%_%s-%s-%s_%_', 'a', null, 'c']} />",
  ],
  [
    '_%_%s extra ignorati_%_',
    <Translate t={['_%_solo %s_%_', 'uno', 'due', 'tre']} />,
    'solo uno',
    "<Translate t={['_%_solo %s_%_', 'uno', 'due', 'tre']} />",
  ],
  [
    '_%_%s in meno_%_',
    <Translate t={['_%_%s e %s_%_', 'uno']} />,
    'uno e ⁇',
    "<Translate t={['_%_%s e %s_%_', 'uno']} />",
  ],
  [
    '_%_%s zero_%_',
    <Translate t={['_%_Zero: %s_%_', 0]} />,
    'Zero: 0',
    "<Translate t={['_%_Zero: %s_%_', 0]} />",
  ],
  [
    '_%_%s stringa vuota_%_',
    <Translate t={['_%_tra parentesi: (%s)_%_', '']} />,
    'tra parentesi: ()',
    "<Translate t={['_%_tra parentesi: (%s)_%_', '']} />",
  ],
  [
    '_%_%s null_%_',
    <Translate t={['_%_null: %s_%_', null]} />,
    'null: ⁇',
    "<Translate t={['_%_null: %s_%_', null]} />",
  ],
  [
    '_%_%s senza argomenti_%_',
    <Translate t={'_%_niente: %s_%_'} />,
    'niente: ⁇',
    "<Translate t={'_%_niente: %s_%_'} />",
  ],
  [
    '_%_a array vuoto_%_',
    <Translate t={'_%_Vuoto: %s_%_'} a={[]} />,
    'Vuoto: ⁇',
    "<Translate t={'_%_Vuoto: %s_%_'} a={[]} />",
  ],
  [
    '_%_a false_%_',
    <Translate t={'_%_Falso: %s_%_'} a={false} />,
    'Falso: ⁇ (false = "non passato")',
    "<Translate t={'_%_Falso: %s_%_'} a={false} />",
  ],
  [
    '_%_%s letterale come dato_%_',
    <Translate t={['_%_il testo %s è letterale_%_', '%s']} />,
    'il testo %s è letterale (unico modo di mostrare un %s)',
    "<Translate t={['_%_il testo %s è letterale_%_', '%s']} />",
  ],
  [
    '_%_% non seguito da s_%_',
    <Translate>_%_Sconto del 50% oggi, 100% sicuro_%_</Translate>,
    'Sconto del 50% oggi, 100% sicuro',
    '<Translate>_%_Sconto del 50% oggi, 100% sicuro_%_</Translate>',
  ],
  [
    '_%_%s dentro una parola_%_',
    <Translate>_%_Sconto 100%sicuro_%_</Translate>,
    'Sconto 100⁇icuro (trappola: %s attaccato al testo)',
    '<Translate>_%_Sconto 100%sicuro_%_</Translate>',
  ],

  // ============================================================
  '_%_Argomenti che sono nodi React_%_',
  // ============================================================
  [
    '_%_Elemento come argomento_%_',
    <Translate t={['_%_Ciao %s_%_', <b>Mario</b>]} />,
    <>
      Ciao <b>Mario</b> (grassetto reale, non "[object Object]")
    </>,
    "<Translate t={['_%_Ciao %s_%_', <b>Mario</b>]} />",
  ],
  [
    '_%_Elemento dentro <b>_%_',
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
    '_%_Elemento al posto del testo_%_',
    <Translate t={<b>sono un elemento</b>} />,
    <>
      <b>sono un elemento</b> (reso com’è, nessun prefisso)
    </>,
    '<Translate t={<b>sono un elemento</b>} />',
  ],
  [
    '_%_Elemento nel primo slot della tupla_%_',
    <Translate t={[<b>errore</b>, 'x']} />,
    '🚫[badDom] (lì il testo è il testo: resta un errore)',
    "<Translate t={[<b>errore</b>, 'x']} />",
  ],

  // ============================================================
  '_%_Dialetto HTML dentro il marcatore_%_',
  // ============================================================
  [
    '_%_b / i_%_',
    <Translate t={'_%_Testo <b>in grassetto</b> e <i>corsivo</i>_%_'} />,
    <>
      Testo <b>in grassetto</b> e <i>corsivo</i>
    </>,
    "<Translate t={'_%_Testo <b>in grassetto</b> e <i>corsivo</i>_%_'} />",
  ],
  [
    '_%_%s dentro <b>_%_',
    <Translate t={['_%_<b>%s</b>_%_', 'bold']} />,
    <b>bold</b>,
    "<Translate t={['_%_<b>%s</b>_%_', 'bold']} />",
  ],
  [
    '_%_br_%_',
    <Translate t={'_%_riga uno<br>riga due_%_'} />,
    <>
      riga uno
      <br />
      riga due
    </>,
    "<Translate t={'_%_riga uno<br>riga due_%_'} />",
  ],
  [
    '_%_Attributi scartati_%_',
    <Translate
      t={'_%_<b class="x" title="y" onclick="boom()">solo grassetto</b>_%_'}
    />,
    <>
      <b>solo grassetto</b> (nessun attributo sopravvive)
    </>,
    `<Translate t={'_%_<b class="x" title="y" onclick="boom()">solo grassetto</b>_%_'} />`,
  ],
  [
    '_%_Tag sconosciuto sciolto_%_',
    <Translate t={'_%_<div>sciolto</div> e <span>anche</span>_%_'} />,
    'sciolto e anche',
    "<Translate t={'_%_<div>sciolto</div> e <span>anche</span>_%_'} />",
  ],
  [
    '_%_script sciolto_%_',
    <Translate t={'_%_<script>alert(1)</script>_%_'} />,
    'alert(1) come testo, niente esecuzione',
    "<Translate t={'_%_<script>alert(1)</script>_%_'} />",
  ],
  [
    '_%_Tag lasciato aperto_%_',
    <Translate t={'_%_<b>resta aperto_%_'} />,
    <>
      <b>resta aperto</b> (chiuso implicitamente a fine stringa)
    </>,
    "<Translate t={'_%_<b>resta aperto_%_'} />",
  ],
  [
    '_%_Chiusura spaiata_%_',
    <Translate t={'_%_testo </b> spaiato_%_'} />,
    'testo  spaiato (il tag spaiato si ignora)',
    "<Translate t={'_%_testo </b> spaiato_%_'} />",
  ],
  [
    '_%_Commento HTML_%_',
    <Translate t={'_%_prima<!-- nascosto -->dopo_%_'} />,
    'primadopo',
    "<Translate t={'_%_prima<!-- nascosto -->dopo_%_'} />",
  ],
  [
    '_%_Entità_%_',
    <Translate t={'_%_5 &lt; 10 &amp; 10 &gt; 5_%_'} />,
    '5 < 10 & 10 > 5',
    "<Translate t={'_%_5 &lt; 10 &amp; 10 &gt; 5_%_'} />",
  ],
  [
    '_%_Entità che sembra un tag_%_',
    <Translate t={'_%_&lt;b&gt;non grassetto&lt;/b&gt;_%_'} />,
    '<b>non grassetto</b> come testo, non in grassetto',
    "<Translate t={'_%_&lt;b&gt;non grassetto&lt;/b&gt;_%_'} />",
  ],
  [
    '_%_Tag incrociati_%_',
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
    '_%_Markup come JSX (rotto)_%_',
    <Translate>
      _%_<marquee>boom</marquee>_%_
    </Translate>,
    '‼️_%_ — i "_%_" sono due JSXText separati: niente chiave, e marquee viene buttato',
    '<Translate>_%_<marquee>boom</marquee>_%_</Translate>',
  ],

  // ============================================================
  '_%_Testo non marcato e skipMark_%_',
  // ============================================================
  [
    '_%_Non marcato_%_',
    <Translate>Questa stringa è senza marcatori</Translate>,
    '‼️Questa stringa è senza marcatori',
    '<Translate>Questa stringa è senza marcatori</Translate>',
  ],
  [
    '_%_Non marcato con accenti_%_',
    <Translate>è già tutto pronto, è un'occasione</Translate>,
    "‼️è già tutto pronto, è un'occasione",
    "<Translate>è già tutto pronto, è un'occasione</Translate>",
  ],
  [
    '_%_Non marcato + %s_%_',
    <Translate t={'ordine numero %s'} a={7} />,
    '‼️ordine numero 7 (l’interpolazione funziona lo stesso)',
    "<Translate t={'ordine numero %s'} a={7} />",
  ],
  [
    '_%_skipMark_%_',
    <Translate t={'+39 02 1234567'} skipMark />,
    '+39 02 1234567 (nessun ‼️, nessun warning)',
    "<Translate t={'+39 02 1234567'} skipMark />",
  ],
  [
    '_%_skipMark + %s_%_',
    <Translate t={'ordine numero %s'} a={7} skipMark />,
    'ordine numero 7',
    "<Translate t={'ordine numero %s'} a={7} skipMark />",
  ],
  [
    '_%_skipMark su testo marcato_%_',
    <Translate t={'_%_skipMark qui non fa niente_%_'} skipMark />,
    'skipMark qui non fa niente (la prop è inerte, 🔸/🔹 restano)',
    "<Translate t={'_%_skipMark qui non fa niente_%_'} skipMark />",
  ],
  [
    '_%_children misti_%_',
    <Translate>testo {'ed espressione'}</Translate>,
    '‼️testo  (i children sono una tupla: il secondo diventa un argomento e sparisce)',
    "<Translate>testo {'ed espressione'}</Translate>",
  ],

  // ============================================================
  '_%_Valori che testo non sono_%_',
  // ============================================================
  [
    '_%_Numero_%_',
    <Translate t={42} />,
    '42 (dato di dominio, nessun ‼️)',
    '<Translate t={42} />',
  ],
  [
    '_%_Zero_%_',
    <Translate t={0} />,
    '0 (zero è un valore, non "niente")',
    '<Translate t={0} />',
  ],
  ['_%_BigInt_%_', <Translate t={10n} />, '10', '<Translate t={10n} />'],
  ['_%_Stringa vuota_%_', <Translate t="" />, '(vuoto)', '<Translate t="" />'],
  ['_%_null_%_', <Translate t={null} />, '(vuoto)', '<Translate t={null} />'],
  [
    '_%_undefined_%_',
    <Translate t={undefined} />,
    '(vuoto: undefined fa scattare il default della prop)',
    '<Translate t={undefined} />',
  ],
  ['_%_Nessuna prop_%_', <Translate />, '(vuoto)', '<Translate />'],
  ['_%_o null_%_', <Translate o={null} />, '(vuoto)', '<Translate o={null} />'],
  [
    '_%_Oggetto senza t_%_',
    <Translate t={{ foo: 'bar' }} />,
    '(vuoto + un console.error una volta sola)',
    "<Translate t={{ foo: 'bar' }} />",
  ],
  [
    '_%_Oggetto { t: null }_%_',
    <Translate t={{ t: null }} />,
    '(vuoto: forma { t, a } valida, testo assente)',
    '<Translate t={{ t: null }} />',
  ],
  [
    '_%_true_%_',
    <Translate t={true} />,
    '🚫[true] (niente da salvare: si dice cosa c’era)',
    '<Translate t={true} />',
  ],
  ['_%_Array vuoto_%_', <Translate t={[]} />, '🚫[array]', '<Translate t={[]} />'],
  [
    '_%_Tupla che porta solo null_%_',
    <Translate t={[null]} />,
    '🚫[nullArray] (la tupla c’è, il posto del testo è vuoto)',
    '<Translate t={[null]} />',
  ],
  [
    '_%_Funzione_%_',
    <Translate t={() => 'x'} />,
    '🚫[func]',
    "<Translate t={() => 'x'} />",
  ],
  [
    '_%_Symbol_%_',
    <Translate t={Symbol('x')} />,
    '🚫[symbol]',
    "<Translate t={Symbol('x')} />",
  ],

  // ============================================================
  '_%_Prop incompatibili: il testo non si perde più_%_',
  // ============================================================
  [
    '_%_o + t_%_',
    <Translate o={{ t: '_%_vince oggetto_%_' }} t={'_%_t_%_'} />,
    '‼️vince oggetto (o è il canale esplicito)',
    "<Translate o={{ t: '_%_vince oggetto_%_' }} t={'_%_t_%_'} />",
  ],
  [
    '_%_o + children_%_',
    <Translate o={{ t: '_%_o vince su children_%_' }}>
      _%_children_%_
    </Translate>,
    '‼️o vince su children',
    "<Translate o={{ t: '_%_o vince su children_%_' }}>_%_children_%_</Translate>",
  ],
  [
    '_%_t + children_%_',
    <Translate t={'_%_vince t_%_'}>_%_children_%_</Translate>,
    '‼️vince t',
    "<Translate t={'_%_vince t_%_'}>_%_children_%_</Translate>",
  ],
  [
    '_%_tupla + a_%_',
    <Translate t={['_%_%s_%_', 'vince la tupla']} a={['y']} />,
    '‼️vince la tupla',
    "<Translate t={['_%_%s_%_', 'vince la tupla']} a={['y']} />",
  ],
  [
    '_%_t="" + children_%_',
    <Translate t="">_%_i children non spariscono_%_</Translate>,
    '‼️i children non spariscono (la stringa vuota non conta come testo)',
    '<Translate t="">_%_i children non spariscono_%_</Translate>',
  ],
  [
    '_%_t + children, nessuno dei due è testo_%_',
    <Translate t={<b>a</b>}>{<i>b</i>}</Translate>,
    '🚫[badDom] (prop incompatibili E niente da salvare)',
    '<Translate t={<b>a</b>}>{<i>b</i>}</Translate>',
  ],

  // ============================================================
  '_%_Testi veri_%_',
  // ============================================================
  [
    '_%_Accenti marcati_%_',
    <Translate>_%_Perché è già un'occasione? À È Ì Ò Ù à è ì ò ù_%_</Translate>,
    "Perché è già un'occasione? À È Ì Ò Ù à è ì ò ù",
    "<Translate>_%_Perché è già un'occasione? À È Ì Ò Ù à è ì ò ù_%_</Translate>",
  ],
  [
    '_%_Accenti + %s_%_',
    <Translate t={['_%_Ciao %s, come stai?_%_', 'Già']} />,
    'Ciao Già, come stai?',
    "<Translate t={['_%_Ciao %s, come stai?_%_', 'Già']} />",
  ],
  [
    '_%_Emoji_%_',
    <Translate>_%_Benvenuto 👋 🚀_%_</Translate>,
    'Benvenuto 👋 🚀',
    '<Translate>_%_Benvenuto 👋 🚀_%_</Translate>',
  ],
  [
    '_%_Cirillico / greco / CJK_%_',
    <Translate>_%_Привет · Γειά σου · 你好 · こんにちは_%_</Translate>,
    'Привет · Γειά σου · 你好 · こんにちは',
    '<Translate>_%_Привет · Γειά σου · 你好 · こんにちは_%_</Translate>',
  ],
  [
    '_%_Virgolette e backslash_%_',
    <Translate t={'_%_"virgolette", \'apici\' e \\ backslash_%_'} />,
    '"virgolette", \'apici\' e \\ backslash',
    `<Translate t={'_%_"virgolette", \\'apici\\' e \\\\ backslash_%_'} />`,
  ],
  [
    '_%_Nuova riga_%_',
    <Translate t={'_%_riga 1\nriga 2_%_'} />,
    'riga 1 riga 2 su una riga sola: l’a-capo lo mangia l’HTML, serve <br>',
    "<Translate t={'_%_riga 1\\nriga 2_%_'} />",
  ],
  [
    '_%_Testo lungo su più righe_%_',
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