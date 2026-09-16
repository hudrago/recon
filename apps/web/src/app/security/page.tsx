import { PublicLegalShell } from '@/components/PublicLegalShell';
import { getTranslations } from '@/lib/server-i18n';

export default async function SecurityPage() {
  const { locale } = await getTranslations();
  const pt = locale === 'pt';
  return (
    <PublicLegalShell eyebrow={pt ? 'Confiança operacional' : 'Operational trust'} title={pt ? 'Segurança na Recon' : 'Security at Recon'} updatedAt="16-09-2026">
      <section><h2>{pt ? 'Proteção de dados' : 'Data protection'}</h2><p>{pt ? 'As ligações usam TLS e os dados persistentes são protegidos pelos controlos da infraestrutura gerida. Segredos de fornecedores permanecem no servidor e nunca são enviados para o browser.' : 'Connections use TLS and persisted data is protected by managed-infrastructure controls. Provider secrets remain server-side and are never sent to the browser.'}</p></section>
      <section><h2>{pt ? 'Acesso e isolamento' : 'Access and isolation'}</h2><p>{pt ? 'Cada pedido autenticado verifica a sessão e a pertença à organização. Os identificadores da organização são validados no servidor para impedir acesso entre clientes.' : 'Every authenticated request verifies the session and organization membership. Organization identifiers are validated server-side to prevent cross-tenant access.'}</p></section>
      <section><h2>{pt ? 'Ações financeiras' : 'Financial actions'}</h2><p>{pt ? 'Reembolsos, reposições e documentos exigem aprovação humana, salvo configuração explícita. Chaves de idempotência impedem efeitos duplicados e cada execução fica registada para auditoria.' : 'Refunds, restocks, and documents require human approval unless explicitly configured otherwise. Idempotency keys prevent duplicate effects and each execution is recorded for audit.'}</p></section>
      <section><h2>{pt ? 'Operação e recuperação' : 'Operations and recovery'}</h2><p>{pt ? 'Aplicamos atualizações, monitorizamos falhas e limitamos privilégios operacionais. A recuperação depende de cópias de segurança e procedimentos do fornecedor de infraestrutura.' : 'We apply updates, monitor failures, and limit operational privileges. Recovery relies on managed-infrastructure backups and provider recovery procedures.'}</p></section>
      <section><h2>{pt ? 'Responsabilidade partilhada' : 'Shared responsibility'}</h2><p>{pt ? 'Os clientes devem proteger credenciais, limitar membros da organização e rever ações antes de aprovar. A Recon não solicita palavras-passe por email.' : 'Customers must protect credentials, limit organization membership, and review actions before approval. Recon never requests passwords by email.'}</p></section>
      <section><h2>{pt ? 'Comunicar uma vulnerabilidade' : 'Report a vulnerability'}</h2><p>{pt ? 'Envie detalhes para ola@recon.pt. Não aceda a dados de terceiros, não interrompa o serviço e conceda tempo razoável para investigação antes de divulgar.' : 'Send details to ola@recon.pt. Do not access third-party data, disrupt the service, or disclose the issue before allowing reasonable investigation time.'}</p></section>
    </PublicLegalShell>
  );
}