/**
 * Informational-only Nexa Maya + Agentics planning benefit.
 * Separate from the existing read-only Premium financial consultant.
 * No API calls, authorization, wallet access, tokens, storage or execution.
 * Review-only bridge is not yet released to real customers.
 */
const EXAMPLES = [
  ['Pesquisa orientada', 'Transformar um tema complexo em tópicos para conferir.'],
  ['Organização de agenda', 'Dividir uma semana em prioridades e etapas sugeridas.'],
  ['Comunicação', 'Preparar um rascunho de mensagem para sua revisão.'],
  ['Comparação de opções', 'Organizar critérios e alternativas sem iniciar compras.'],
];
export default function MayaAgenticsPlanningBenefit() {
  return (
    <section className="hero-card" aria-label="Novidade Maya Agentics Premium em homologação" style={{marginBottom:16}}>
      <span className="status-pill" style={{display:'inline-block',marginBottom:12}}>Benefício Premium · em homologação</span>
      <h2 style={{marginTop:0}}>Maya + Agentics: da pergunta ao plano</h2>
      <p>A Maya continua disponível com seus recursos atuais. Estamos preparando o planejamento avançado com Agentics como um benefício adicional do Nexa Premium.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12,margin:'18px 0'}}>
        <div style={{padding:16,borderRadius:16,border:'1px solid rgba(148,163,184,.23)'}}>
          <strong>Maya para todos</strong>
          <p style={{fontSize:13}}>Conversar, pesquisar e utilizar as funcionalidades da assistente já disponíveis.</p>
        </div>
        <div style={{padding:16,borderRadius:16,border:'1px solid rgba(34,211,238,.55)'}}>
          <strong>Maya + Agentics Premium</strong>
          <p style={{fontSize:13}}>Organizar solicitações complexas em etapas, com rascunhos e aprovação humana.</p>
        </div>
      </div>
      <h3 style={{fontSize:16}}>Exemplos do planejamento em desenvolvimento</h3>
      <ul>{EXAMPLES.map(([name,description])=><li key={name}><strong>{name}:</strong> {description}</li>)}</ul>
      <p style={{fontSize:13,opacity:.85}}>Esta apresentação é informativa. O novo planejamento ainda não está disponível para contas reais. Não autoriza envio de mensagens, execução de tarefas ou movimentações financeiras.</p>
      <button className="secondary-button" type="button" disabled aria-disabled="true">Planejamento Agentics — em breve</button>
    </section>
  );
}
