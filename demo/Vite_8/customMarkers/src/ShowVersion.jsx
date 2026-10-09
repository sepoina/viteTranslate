import { version } from '@sepoina/vitetranslate/react';

export default function ShowVersion() {
  return (
    <div
      style={{
        marginLeft: '-27px',
        marginTop: '-11px',
        marginBottom: '11px',
        backgroundColor: '#b0ffff28',
        width: 'fit-content',
        paddingLeft: '29px',
        paddingRight: '38px',
        paddingBottom: '3px',
        borderRadius: '0px 15px 32px 0px',
      }}
    >
      <small>
        <span style={{ opacity: 0.4, paddingRight: '8px' }}>⠶</span>
        {/* 4) Il testo JSX fra i delimitatori, anche con un tag e un valore in mezzo. */}
        ≼versione&nbsp;<b>{version}</b>≽
      </small>
    </div>
  );
}
