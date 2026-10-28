-- Migração para banco VotaLivre 1.0 já existente; executar uma vez.

-- Cadastro web com convite emitido pelo operador: convite único e confirmação MFA.
CREATE TABLE organization_registration_invites (
 code_hash CHAR(64) PRIMARY KEY,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL,
 consumed_at TIMESTAMPTZ,
 organization_id UUID REFERENCES organizations(id),
 CHECK (expires_at > created_at)
);
CREATE INDEX idx_org_invites_expire ON organization_registration_invites(expires_at);
CREATE TABLE admin_enrollments (
 token_hash CHAR(64) PRIMARY KEY,
 user_id UUID NOT NULL UNIQUE REFERENCES admin_users(id),
 expires_at TIMESTAMPTZ NOT NULL,
 failures SMALLINT NOT NULL DEFAULT 0 CHECK(failures BETWEEN 0 AND 5),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_admin_enrollments_expire ON admin_enrollments(expires_at);
