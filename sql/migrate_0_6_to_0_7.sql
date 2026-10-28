-- Execute SOMENTE em banco v0.6 válido, após backup e aprovação administrativa.
-- Não modifica tabelas de votos e recibos existentes.
BEGIN;

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

COMMIT;
