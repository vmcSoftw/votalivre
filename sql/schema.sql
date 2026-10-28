-- VotaLivre Secure v0.6: executar APENAS em novo banco, sem dados da versão anterior.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE organizations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE admin_users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id),
 email TEXT NOT NULL, password_hash TEXT NOT NULL, totp_secret TEXT NOT NULL,
 last_totp_step BIGINT NOT NULL DEFAULT 0, role TEXT NOT NULL DEFAULT 'manager' CHECK(role IN ('owner','manager','auditor')),
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organization_id,email)
);
CREATE TABLE admin_sessions (
 session_hash CHAR(64) PRIMARY KEY, user_id UUID NOT NULL REFERENCES admin_users(id),
 expires_at TIMESTAMPTZ NOT NULL, last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE auth_attempts (
 identifier_hash CHAR(64) PRIMARY KEY, window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(), failures INT NOT NULL DEFAULT 0
);
CREATE TABLE elections (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id),
 organization_name TEXT NOT NULL CHECK(length(organization_name) BETWEEN 2 AND 120),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 160),
 description TEXT NOT NULL DEFAULT '', starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT valid_dates CHECK (ends_at>starts_at)
);
CREATE INDEX idx_elections_org ON elections(organization_id);
CREATE TABLE ballot_options (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), election_id UUID NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
 label TEXT NOT NULL CHECK(length(label) BETWEEN 2 AND 160), kind TEXT NOT NULL DEFAULT 'candidate' CHECK(kind IN ('candidate','blank','null')),
 position INT NOT NULL, UNIQUE(election_id,position), UNIQUE(election_id,id)
);
CREATE TABLE issue_batches (
 id UUID PRIMARY KEY, election_id UUID NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
 created_by UUID NOT NULL REFERENCES admin_users(id),
 pins_ciphertext TEXT, quantity SMALLINT NOT NULL CHECK(quantity BETWEEN 1 AND 300),
 delivered_at TIMESTAMPTZ, delivered_by UUID REFERENCES admin_users(id),
 revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(delivered_at IS NULL OR pins_ciphertext IS NULL)
);
CREATE INDEX idx_issue_batches_election ON issue_batches(election_id);
CREATE UNIQUE INDEX idx_issue_batches_composite ON issue_batches(election_id,id);
CREATE TABLE voter_tokens (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), election_id UUID NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
 issue_batch_id UUID NOT NULL, revoked_at TIMESTAMPTZ,
 token_hash CHAR(64) NOT NULL UNIQUE, pin_hash CHAR(64) NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 FOREIGN KEY(election_id,issue_batch_id) REFERENCES issue_batches(election_id,id)
);
CREATE INDEX idx_voter_tokens_election ON voter_tokens(election_id);
-- Limites temporários das tentativas de confirmação; não contêm escolhas eleitorais.
CREATE TABLE voter_auth_attempts (
 token_hash CHAR(64) PRIMARY KEY,
 election_id UUID NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
 window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 failures SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_voter_auth_attempts_window ON voter_auth_attempts(window_start);
CREATE TABLE request_rate_limits (
 bucket_key CHAR(64) PRIMARY KEY,
 window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0)
);
CREATE INDEX idx_request_rate_limits_window ON request_rate_limits(window_start);
-- Sem choice em claro, opção_id, token, IP, matrícula ou horário individual na tabela de votos.
CREATE TABLE ballots (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), election_id UUID NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
 encrypted_choice TEXT NOT NULL
);
CREATE INDEX idx_ballots_election ON ballots(election_id);
-- Sem associação armazenada entre recibo e cédula.
CREATE TABLE ballot_receipts (
 election_id UUID NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
 receipt_hash CHAR(64) NOT NULL UNIQUE
);
CREATE INDEX idx_ballot_receipts_election ON ballot_receipts(election_id);
-- Documento de fechamento assinado fora do servidor web.
CREATE TABLE audit_snapshots (
 election_id UUID PRIMARY KEY REFERENCES elections(id) ON DELETE RESTRICT,
 manifest_text TEXT NOT NULL,
 signature_base64url TEXT NOT NULL,
 public_key_pem TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Impede alterações casuais por SQL comum depois da lacração (superusuário pode contornar).
CREATE OR REPLACE FUNCTION refuse_sealed_election_changes() RETURNS TRIGGER AS $$
DECLARE relevant_id uuid;
BEGIN
 relevant_id:=COALESCE(NEW.election_id,OLD.election_id);
 IF EXISTS(SELECT 1 FROM audit_snapshots WHERE election_id=relevant_id) THEN
   RAISE EXCEPTION 'Eleição lacrada: modificação proibida';
 END IF;
 RETURN COALESCE(NEW,OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER seal_ballots BEFORE INSERT OR UPDATE OR DELETE ON ballots
 FOR EACH ROW EXECUTE FUNCTION refuse_sealed_election_changes();
CREATE TRIGGER seal_receipts BEFORE INSERT OR UPDATE OR DELETE ON ballot_receipts
 FOR EACH ROW EXECUTE FUNCTION refuse_sealed_election_changes();
CREATE TRIGGER seal_tokens BEFORE INSERT OR UPDATE OR DELETE ON voter_tokens
 FOR EACH ROW EXECUTE FUNCTION refuse_sealed_election_changes();
-- As opções e metadados da eleição não podem mudar após a abertura.
CREATE OR REPLACE FUNCTION refuse_open_ballot_changes() RETURNS TRIGGER AS $$
DECLARE election_start timestamptz;
BEGIN
 SELECT starts_at INTO election_start FROM elections WHERE id=COALESCE(NEW.election_id,OLD.election_id);
 IF election_start<=NOW() THEN RAISE EXCEPTION 'Cédula já aberta: opções não podem mudar'; END IF;
 RETURN COALESCE(NEW,OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER freeze_options BEFORE UPDATE OR DELETE ON ballot_options
 FOR EACH ROW EXECUTE FUNCTION refuse_open_ballot_changes();
-- O banco não comprova imutabilidade contra superusuário; é necessário publicar a impressão do manifesto em custódia externa.
-- Restrições de escrita da aplicação; não substituem privilégio mínimo nem fiscalização independente.
CREATE OR REPLACE FUNCTION refuse_vote_mutation() RETURNS TRIGGER AS $$
BEGIN
 RAISE EXCEPTION 'Voto/recibo é somente acréscimo: atualização ou remoção proibida';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER ballots_append_only BEFORE UPDATE OR DELETE ON ballots
 FOR EACH ROW EXECUTE FUNCTION refuse_vote_mutation();
CREATE TRIGGER receipts_append_only BEFORE UPDATE OR DELETE ON ballot_receipts
 FOR EACH ROW EXECUTE FUNCTION refuse_vote_mutation();
CREATE OR REPLACE FUNCTION one_way_token_use() RETURNS TRIGGER AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.election_id IS DISTINCT FROM OLD.election_id OR NEW.issue_batch_id IS DISTINCT FROM OLD.issue_batch_id
  OR NEW.token_hash IS DISTINCT FROM OLD.token_hash OR NEW.pin_hash IS DISTINCT FROM OLD.pin_hash
  OR NEW.created_at IS DISTINCT FROM OLD.created_at
  OR (NEW.used_at IS DISTINCT FROM OLD.used_at AND (OLD.used_at IS NOT NULL OR NEW.used_at IS NULL OR NEW.revoked_at IS NOT NULL))
  OR (NEW.revoked_at IS DISTINCT FROM OLD.revoked_at AND (OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.used_at IS NOT NULL)) THEN
  RAISE EXCEPTION 'Uso único da credencial: mudança inválida';
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER tokens_one_way BEFORE UPDATE ON voter_tokens
 FOR EACH ROW EXECUTE FUNCTION one_way_token_use();
CREATE OR REPLACE FUNCTION refuse_manifest_change() RETURNS TRIGGER AS $$
BEGIN
 RAISE EXCEPTION 'Documento de lacração permanente: atualização/remoção proibida';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER snapshot_append_only BEFORE UPDATE OR DELETE ON audit_snapshots
 FOR EACH ROW EXECUTE FUNCTION refuse_manifest_change();
CREATE OR REPLACE FUNCTION freeze_started_election() RETURNS TRIGGER AS $$
BEGIN
 IF OLD.starts_at<=NOW() THEN RAISE EXCEPTION 'Eleição iniciada: metadados bloqueados'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER freeze_election_properties BEFORE UPDATE ON elections
 FOR EACH ROW EXECUTE FUNCTION freeze_started_election();


-- v0.7 | Gestão institucional e apuração de quórum.
ALTER TABLE organizations ADD COLUMN organization_type TEXT NOT NULL DEFAULT 'school'
 CHECK(organization_type IN ('school','company','association','other'));
ALTER TABLE elections ADD COLUMN election_type TEXT NOT NULL DEFAULT 'other'
 CHECK(election_type IN ('student','staff','cipa','council','association','other'));
ALTER TABLE elections ADD COLUMN quorum_percent INTEGER NOT NULL DEFAULT 0
 CHECK(quorum_percent BETWEEN 0 AND 100);
ALTER TABLE elections ADD COLUMN tie_rule TEXT NOT NULL DEFAULT 'commission'
 CHECK(tie_rule IN ('commission','runoff'));
-- O cadastro contém apenas um HMAC do identificador e o nome cifrado;
-- NUNCA contém senha de eleitor, credencial, recibo ou preferência de voto.
CREATE TABLE eligible_voters (
 election_id UUID NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
 identifier_digest CHAR(64) NOT NULL,
 encrypted_name TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(election_id,identifier_digest)
);
CREATE INDEX idx_eligible_voters_election ON eligible_voters(election_id);
-- Trava-se a lista após a emissão da primeira credencial OU o início da votação.
CREATE OR REPLACE FUNCTION freeze_eligible_voters() RETURNS TRIGGER AS $$
DECLARE target_id UUID; election_start TIMESTAMPTZ;
BEGIN
 target_id:=COALESCE(NEW.election_id,OLD.election_id);
 SELECT starts_at INTO election_start FROM elections WHERE id=target_id FOR UPDATE;
 IF election_start<=NOW() OR EXISTS(SELECT 1 FROM voter_tokens WHERE election_id=target_id) THEN
  RAISE EXCEPTION 'Cadastro de aptos bloqueado após emissão de credenciais ou início da votação';
 END IF;
 RETURN COALESCE(NEW,OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER roster_freeze_insert BEFORE INSERT ON eligible_voters
 FOR EACH ROW EXECUTE FUNCTION freeze_eligible_voters();
CREATE TRIGGER roster_freeze_update BEFORE UPDATE OR DELETE ON eligible_voters
 FOR EACH ROW EXECUTE FUNCTION freeze_eligible_voters();
CREATE TABLE admin_activity (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id UUID NOT NULL REFERENCES organizations(id),
 election_id UUID REFERENCES elections(id),
 actor_id UUID NOT NULL REFERENCES admin_users(id),
 action TEXT NOT NULL CHECK(length(action) BETWEEN 4 AND 100),
 detail TEXT NOT NULL DEFAULT '' CHECK(length(detail)<=300),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_admin_activity_org ON admin_activity(organization_id,created_at DESC);
CREATE OR REPLACE FUNCTION refuse_admin_activity_mutation() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'Registro administrativo é somente acréscimo'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER activity_append_only BEFORE UPDATE OR DELETE ON admin_activity
 FOR EACH ROW EXECUTE FUNCTION refuse_admin_activity_mutation();

-- v0.8: certificado de endossos públicos independente dos votos e recibos.
CREATE TABLE committee_certificates (
 election_id UUID PRIMARY KEY REFERENCES elections(id) ON DELETE RESTRICT,
 certificate_text TEXT NOT NULL CHECK(length(certificate_text) BETWEEN 100 AND 2000000),
 published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION refuse_committee_certificate_mutation() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'Certificado de comissão é somente acréscimo'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER committee_certificate_append_only BEFORE UPDATE OR DELETE ON committee_certificates
 FOR EACH ROW EXECUTE FUNCTION refuse_committee_certificate_mutation();
