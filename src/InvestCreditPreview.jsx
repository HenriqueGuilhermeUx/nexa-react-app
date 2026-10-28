import {useEffect, useState} from 'react';

/** Read-only preview. Does not authorize, sign or execute any financial operation. */
export default function InvestCreditPreview({accessToken, apiUrl}) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [collateral, setCollateral] = useState('1000');
  const [borrow, setBorrow] = useState('400');
  const [drop, setDrop] = useState('25');
  const [result, setResult] = useState(null);
  const [working, setWorking] = useState(false);
  const previewAvailable = Boolean(catalog?.products?.some((product) => product.status === 'information_only'));
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetch(apiUrl.replace(/\/$/, '') + '/invest-credit/catalog?market=BR&audience=WALLET', {
      headers: {Authorization: 'Bearer ' + accessToken},
    }).then(async (response) => {
      if (!response.ok) throw new Error('Catálogo temporariamente indisponível');
      return response.json();
    }).then((data) => {if (!cancelled) setCatalog(data);})
      .catch((caught) => {if (!cancelled) setError(caught.message);});
    return () => {cancelled = true;};
  }, [accessToken, apiUrl]);

  async function simulate(event) {
    event.preventDefault();
    if (!previewAvailable) return;
    setWorking(true);
    setError('');
    setResult(null);
    try {
      const params = new URLSearchParams({
        collateralUsd: collateral, borrowUsd: borrow,
        referenceLtvPercent: '60', priceDropPercent: drop,
      });
      const response = await fetch(apiUrl.replace(/\/$/, '') +
        '/invest-credit/simulate-collateral?' + params.toString(), {
        headers: {Authorization: 'Bearer ' + accessToken},
      });
      if (!response.ok) throw new Error('Simulador indisponível ou não habilitado');
      const data = await response.json();
      if (!data.informationalOnly || data.executionEnabled !== false) {
        throw new Error('Resposta fora do modo informativo');
      }
      setResult(data);
    } catch (caught) {
      setError(caught.message || 'Não foi possível simular');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="content-card" aria-label="Investimentos e crédito">
      <h2>Investimentos e crédito</h2>
      <p className="muted">Conheça as possibilidades da Nexa. Nenhuma operação de compra ou empréstimo está habilitada nesta prévia.</p>
      {catalog?.products?.length ? (
        <div className="history-list">
          {catalog.products.map((product) => (
            <div className="history-item" key={product.id}>
              <div><strong>{product.title}</strong><small>{product.description}</small></div>
              <span>{product.status === 'information_only' ? 'Conhecer' : 'Em preparação'}</span>
            </div>
          ))}
        </div>
      ) : <p className="muted">Produtos em preparação.</p>}
      <h3>Simule o efeito de uma queda na garantia</h3>
      {!previewAvailable && <p className="muted" role="status">Simulações ainda não habilitadas para esta conta.</p>}
      <form onSubmit={simulate}>
        <label>Valor da garantia (USD) <input required type="number" min="1" step="0.01" max="1000000000" value={collateral} onChange={(e) => setCollateral(e.target.value)} /></label>
        <label>Valor hipotético da dívida (USD) <input required type="number" min="0" step="0.01" max="1000000000" value={borrow} onChange={(e) => setBorrow(e.target.value)} /></label>
        <label>Queda simulada (%) <input required type="number" min="0" max="100" step="1" value={drop} onChange={(e) => setDrop(e.target.value)} /></label>
        <button type="submit" className="secondary-button" disabled={working || !previewAvailable}>{working ? 'Calculando…' : 'Simular cenário'}</button>
      </form>
      {result && <p role="status">Após a queda, o valor da garantia seria US$ {result.stressedCollateralUsd.toFixed(2)} e a dívida equivaleria a {result.stressedLtvPercent.toFixed(1)}% dela. {result.outsideReferenceLtv ? 'Acima do percentual educativo de referência.' : 'Dentro do percentual educativo de referência.'}</p>}
      {error && <p role="alert" className="muted">{error}</p>}
      <p className="muted"><small>Simulação educativa, sem proposta de crédito, preço executável ou previsão de liquidação. Taxas e limites reais dependerão dos protocolos e parceiros habilitados.</small></p>
    </section>
  );
}
