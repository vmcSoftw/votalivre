-- v0.8: CERTIFICADOS PÚBLICOS DE ENDOSSO DA COMISSÃO
-- Pré-condição: backup e revisão de privilégios; não altera cédulas nem opções.
-- O registro das chaves públicas da comissão DEVE ser preservado externamente ANTES do pleito.
BEGIN;
CREATE TABLE IF NOT EXISTS committee_certificates (
 election_id UUID PRIMARY KEY REFERENCES elections(id) ON DELETE RESTRICT,
 certificate_text TEXT NOT NULL CHECK(length(certificate_text) BETWEEN 100 AND 2000000),
 published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION refuse_committee_certificate_mutation() RETURNS TRIGGER AS $$
BEGIN
 RAISE EXCEPTION 'Certificado de comissão é somente acréscimo';
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS committee_certificate_append_only ON committee_certificates;
CREATE TRIGGER committee_certificate_append_only BEFORE UPDATE OR DELETE ON committee_certificates
 FOR EACH ROW EXECUTE FUNCTION refuse_committee_certificate_mutation();
COMMIT;
