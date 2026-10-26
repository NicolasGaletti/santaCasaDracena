export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      acessos: {
        Row: {
          acao: string;
          em: string;
          id: string;
          internacao_id: string;
          ip: unknown;
          profissional_id: string;
          user_agent: string | null;
        };
        ComputedFields: never;
        Insert: {
          acao: string;
          em?: string;
          id?: string;
          internacao_id: string;
          ip?: unknown;
          profissional_id: string;
          user_agent?: string | null;
        };
        Update: {
          acao?: string;
          em?: string;
          id?: string;
          internacao_id?: string;
          ip?: unknown;
          profissional_id?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "acessos_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "internacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acessos_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "vw_internacoes_lista";
            referencedColumns: ["internacao_id"];
          },
          {
            foreignKeyName: "acessos_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acessos_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
        ];
      };
      anexos: {
        Row: {
          confirmado: boolean;
          data_exame: string;
          descricao: string;
          enviado_em: string;
          enviado_por: string;
          evolucao_id: string;
          id: string;
          internacao_id: string;
          mime: string;
          sha256: string;
          storage_path: string;
          tamanho_bytes: number;
          tipo: Database["public"]["Enums"]["tipo_anexo"];
        };
        ComputedFields: never;
        Insert: {
          confirmado?: boolean;
          data_exame: string;
          descricao?: string;
          enviado_em?: string;
          enviado_por: string;
          evolucao_id: string;
          id?: string;
          internacao_id: string;
          mime: string;
          sha256: string;
          storage_path: string;
          tamanho_bytes: number;
          tipo: Database["public"]["Enums"]["tipo_anexo"];
        };
        Update: {
          confirmado?: boolean;
          data_exame?: string;
          descricao?: string;
          enviado_em?: string;
          enviado_por?: string;
          evolucao_id?: string;
          id?: string;
          internacao_id?: string;
          mime?: string;
          sha256?: string;
          storage_path?: string;
          tamanho_bytes?: number;
          tipo?: Database["public"]["Enums"]["tipo_anexo"];
        };
        Relationships: [
          {
            foreignKeyName: "anexos_enviado_por_fkey";
            columns: ["enviado_por"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anexos_enviado_por_fkey";
            columns: ["enviado_por"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anexos_evolucao_id_fkey";
            columns: ["evolucao_id"];
            isOneToOne: false;
            referencedRelation: "evolucoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anexos_evolucao_id_fkey";
            columns: ["evolucao_id"];
            isOneToOne: false;
            referencedRelation: "vw_evolucoes_timeline";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anexos_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "internacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anexos_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "vw_internacoes_lista";
            referencedColumns: ["internacao_id"];
          },
        ];
      };
      auditoria: {
        Row: {
          antes: Json | null;
          depois: Json | null;
          em: string;
          id: string;
          operacao: string;
          por: string | null;
          registro_id: string;
          tabela: string;
        };
        ComputedFields: never;
        Insert: {
          antes?: Json | null;
          depois?: Json | null;
          em?: string;
          id?: string;
          operacao: string;
          por?: string | null;
          registro_id: string;
          tabela: string;
        };
        Update: {
          antes?: Json | null;
          depois?: Json | null;
          em?: string;
          id?: string;
          operacao?: string;
          por?: string | null;
          registro_id?: string;
          tabela?: string;
        };
        Relationships: [];
      };
      equipes: {
        Row: {
          ativo: boolean;
          id: string;
          nome: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          id?: string;
          nome: string;
        };
        Update: {
          ativo?: boolean;
          id?: string;
          nome?: string;
        };
        Relationships: [];
      };
      evolucoes: {
        Row: {
          adendo_de: string | null;
          assinatura_digital: string | null;
          atualizado_em: string;
          autor_id: string;
          categoria: Database["public"]["Enums"]["categoria_evolucao"];
          conteudo_hash: string | null;
          criado_em: string;
          dados: NonNullable<Json>;
          devolvida_motivo: string | null;
          devolvida_por: string | null;
          enviada_em: string | null;
          finalizada_em: string | null;
          hash_versao: number;
          id: string;
          internacao_id: string;
          snapshot_autor: Json | null;
          snapshot_validador: Json | null;
          status: Database["public"]["Enums"]["status_evolucao"];
          texto_livre: string;
          validada_em: string | null;
          validada_por: string | null;
        };
        ComputedFields: never;
        Insert: {
          adendo_de?: string | null;
          assinatura_digital?: string | null;
          atualizado_em?: string;
          autor_id: string;
          categoria: Database["public"]["Enums"]["categoria_evolucao"];
          conteudo_hash?: string | null;
          criado_em?: string;
          dados?: NonNullable<Json>;
          devolvida_motivo?: string | null;
          devolvida_por?: string | null;
          enviada_em?: string | null;
          finalizada_em?: string | null;
          hash_versao?: number;
          id?: string;
          internacao_id: string;
          snapshot_autor?: Json | null;
          snapshot_validador?: Json | null;
          status?: Database["public"]["Enums"]["status_evolucao"];
          texto_livre?: string;
          validada_em?: string | null;
          validada_por?: string | null;
        };
        Update: {
          adendo_de?: string | null;
          assinatura_digital?: string | null;
          atualizado_em?: string;
          autor_id?: string;
          categoria?: Database["public"]["Enums"]["categoria_evolucao"];
          conteudo_hash?: string | null;
          criado_em?: string;
          dados?: NonNullable<Json>;
          devolvida_motivo?: string | null;
          devolvida_por?: string | null;
          enviada_em?: string | null;
          finalizada_em?: string | null;
          hash_versao?: number;
          id?: string;
          internacao_id?: string;
          snapshot_autor?: Json | null;
          snapshot_validador?: Json | null;
          status?: Database["public"]["Enums"]["status_evolucao"];
          texto_livre?: string;
          validada_em?: string | null;
          validada_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evolucoes_adendo_de_fkey";
            columns: ["adendo_de"];
            isOneToOne: false;
            referencedRelation: "evolucoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_adendo_de_fkey";
            columns: ["adendo_de"];
            isOneToOne: false;
            referencedRelation: "vw_evolucoes_timeline";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_devolvida_por_fkey";
            columns: ["devolvida_por"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_devolvida_por_fkey";
            columns: ["devolvida_por"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "internacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "vw_internacoes_lista";
            referencedColumns: ["internacao_id"];
          },
          {
            foreignKeyName: "evolucoes_validada_por_fkey";
            columns: ["validada_por"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_validada_por_fkey";
            columns: ["validada_por"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
        ];
      };
      impressoes: {
        Row: {
          chave: string | null;
          evolucao_id: string;
          id: string;
          impresso_em: string;
          impresso_por: string;
          via: number;
        };
        ComputedFields: never;
        Insert: {
          chave?: string | null;
          evolucao_id: string;
          id?: string;
          impresso_em?: string;
          impresso_por: string;
          via: number;
        };
        Update: {
          chave?: string | null;
          evolucao_id?: string;
          id?: string;
          impresso_em?: string;
          impresso_por?: string;
          via?: number;
        };
        Relationships: [
          {
            foreignKeyName: "impressoes_evolucao_id_fkey";
            columns: ["evolucao_id"];
            isOneToOne: false;
            referencedRelation: "evolucoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "impressoes_evolucao_id_fkey";
            columns: ["evolucao_id"];
            isOneToOne: false;
            referencedRelation: "vw_evolucoes_timeline";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "impressoes_impresso_por_fkey";
            columns: ["impresso_por"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "impressoes_impresso_por_fkey";
            columns: ["impresso_por"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
        ];
      };
      internacoes: {
        Row: {
          admitido_em: string;
          alta_em: string | null;
          alta_por: string | null;
          equipe_id: string;
          id: string;
          leito_ala: string;
          medico_responsavel_id: string | null;
          motivo_alta: string | null;
          paciente_id: string;
          status: Database["public"]["Enums"]["status_internacao"];
          tipo_alta: Database["public"]["Enums"]["tipo_alta"] | null;
        };
        ComputedFields: never;
        Insert: {
          admitido_em?: string;
          alta_em?: string | null;
          alta_por?: string | null;
          equipe_id: string;
          id?: string;
          leito_ala: string;
          medico_responsavel_id?: string | null;
          motivo_alta?: string | null;
          paciente_id: string;
          status?: Database["public"]["Enums"]["status_internacao"];
          tipo_alta?: Database["public"]["Enums"]["tipo_alta"] | null;
        };
        Update: {
          admitido_em?: string;
          alta_em?: string | null;
          alta_por?: string | null;
          equipe_id?: string;
          id?: string;
          leito_ala?: string;
          medico_responsavel_id?: string | null;
          motivo_alta?: string | null;
          paciente_id?: string;
          status?: Database["public"]["Enums"]["status_internacao"];
          tipo_alta?: Database["public"]["Enums"]["tipo_alta"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "internacoes_alta_por_fkey";
            columns: ["alta_por"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "internacoes_alta_por_fkey";
            columns: ["alta_por"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "internacoes_equipe_id_fkey";
            columns: ["equipe_id"];
            isOneToOne: false;
            referencedRelation: "equipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "internacoes_medico_responsavel_id_fkey";
            columns: ["medico_responsavel_id"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "internacoes_medico_responsavel_id_fkey";
            columns: ["medico_responsavel_id"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "internacoes_paciente_id_fkey";
            columns: ["paciente_id"];
            isOneToOne: false;
            referencedRelation: "pacientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "internacoes_paciente_id_fkey";
            columns: ["paciente_id"];
            isOneToOne: false;
            referencedRelation: "vw_internacoes_lista";
            referencedColumns: ["paciente_id"];
          },
        ];
      };
      internacoes_clinico: {
        Row: {
          comorbidades: string | null;
          diagnostico_inicial: string | null;
          internacao_id: string;
          muc: string | null;
          resumo_alta: string | null;
          snapshot_alta: Json | null;
        };
        ComputedFields: never;
        Insert: {
          comorbidades?: string | null;
          diagnostico_inicial?: string | null;
          internacao_id: string;
          muc?: string | null;
          resumo_alta?: string | null;
          snapshot_alta?: Json | null;
        };
        Update: {
          comorbidades?: string | null;
          diagnostico_inicial?: string | null;
          internacao_id?: string;
          muc?: string | null;
          resumo_alta?: string | null;
          snapshot_alta?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "internacoes_clinico_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: true;
            referencedRelation: "internacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "internacoes_clinico_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: true;
            referencedRelation: "vw_internacoes_lista";
            referencedColumns: ["internacao_id"];
          },
        ];
      };
      leitos_historico: {
        Row: {
          ate: string | null;
          de: string;
          id: string;
          internacao_id: string;
          leito_ala: string;
          por: string | null;
        };
        ComputedFields: never;
        Insert: {
          ate?: string | null;
          de?: string;
          id?: string;
          internacao_id: string;
          leito_ala: string;
          por?: string | null;
        };
        Update: {
          ate?: string | null;
          de?: string;
          id?: string;
          internacao_id?: string;
          leito_ala?: string;
          por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leitos_historico_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "internacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leitos_historico_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "vw_internacoes_lista";
            referencedColumns: ["internacao_id"];
          },
          {
            foreignKeyName: "leitos_historico_por_fkey";
            columns: ["por"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leitos_historico_por_fkey";
            columns: ["por"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
        ];
      };
      membros_equipe: {
        Row: {
          equipe_id: string;
          profissional_id: string;
        };
        ComputedFields: never;
        Insert: {
          equipe_id: string;
          profissional_id: string;
        };
        Update: {
          equipe_id?: string;
          profissional_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "membros_equipe_equipe_id_fkey";
            columns: ["equipe_id"];
            isOneToOne: false;
            referencedRelation: "equipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "membros_equipe_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "membros_equipe_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
        ];
      };
      notificacoes: {
        Row: {
          criada_em: string;
          destinatario_id: string;
          evolucao_id: string | null;
          id: string;
          internacao_id: string | null;
          lida_em: string | null;
          texto: string;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          criada_em?: string;
          destinatario_id: string;
          evolucao_id?: string | null;
          id?: string;
          internacao_id?: string | null;
          lida_em?: string | null;
          texto: string;
          tipo: string;
        };
        Update: {
          criada_em?: string;
          destinatario_id?: string;
          evolucao_id?: string | null;
          id?: string;
          internacao_id?: string | null;
          lida_em?: string | null;
          texto?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notificacoes_destinatario_id_fkey";
            columns: ["destinatario_id"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificacoes_destinatario_id_fkey";
            columns: ["destinatario_id"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificacoes_evolucao_id_fkey";
            columns: ["evolucao_id"];
            isOneToOne: false;
            referencedRelation: "evolucoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificacoes_evolucao_id_fkey";
            columns: ["evolucao_id"];
            isOneToOne: false;
            referencedRelation: "vw_evolucoes_timeline";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificacoes_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "internacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificacoes_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "vw_internacoes_lista";
            referencedColumns: ["internacao_id"];
          },
        ];
      };
      pacientes: {
        Row: {
          cns: string | null;
          convenio: string;
          cpf: string | null;
          criado_em: string;
          data_nascimento: string;
          id: string;
          nome: string;
          nome_mae: string | null;
        };
        ComputedFields: never;
        Insert: {
          cns?: string | null;
          convenio: string;
          cpf?: string | null;
          criado_em?: string;
          data_nascimento: string;
          id?: string;
          nome: string;
          nome_mae?: string | null;
        };
        Update: {
          cns?: string | null;
          convenio?: string;
          cpf?: string | null;
          criado_em?: string;
          data_nascimento?: string;
          id?: string;
          nome?: string;
          nome_mae?: string | null;
        };
        Relationships: [];
      };
      preferencias_notificacao: {
        Row: {
          profissional_id: string;
          push_devolvida: boolean;
          push_validacao: boolean;
        };
        ComputedFields: never;
        Insert: {
          profissional_id: string;
          push_devolvida?: boolean;
          push_validacao?: boolean;
        };
        Update: {
          profissional_id?: string;
          push_devolvida?: boolean;
          push_validacao?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "preferencias_notificacao_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: true;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "preferencias_notificacao_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: true;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
        ];
      };
      profissionais: {
        Row: {
          ativo: boolean;
          categoria: Database["public"]["Enums"]["categoria_evolucao"] | null;
          conselho: string | null;
          id: string;
          nome: string;
          numero_conselho: string | null;
          perfil: Database["public"]["Enums"]["perfil_profissional"];
          uf_conselho: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          categoria?: Database["public"]["Enums"]["categoria_evolucao"] | null;
          conselho?: string | null;
          id: string;
          nome: string;
          numero_conselho?: string | null;
          perfil: Database["public"]["Enums"]["perfil_profissional"];
          uf_conselho?: string | null;
        };
        Update: {
          ativo?: boolean;
          categoria?: Database["public"]["Enums"]["categoria_evolucao"] | null;
          conselho?: string | null;
          id?: string;
          nome?: string;
          numero_conselho?: string | null;
          perfil?: Database["public"]["Enums"]["perfil_profissional"];
          uf_conselho?: string | null;
        };
        Relationships: [];
      };
      push_assinaturas: {
        Row: {
          auth: string;
          criada_em: string;
          endpoint: string;
          id: string;
          p256dh: string;
          profissional_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          criada_em?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          profissional_id: string;
        };
        Update: {
          auth?: string;
          criada_em?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          profissional_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_assinaturas_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "push_assinaturas_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      vw_evolucoes_timeline: {
        Row: {
          adendo_de: string | null;
          assinatura_digital: string | null;
          atualizado_em: string;
          autor_id: string;
          autor_nome: string | null;
          categoria: Database["public"]["Enums"]["categoria_evolucao"];
          conteudo_hash: string | null;
          criado_em: string;
          dados: NonNullable<Json>;
          devolvida_motivo: string | null;
          devolvida_por: string | null;
          devolvida_por_nome: string | null;
          enviada_em: string | null;
          finalizada_em: string | null;
          hash_versao: number;
          id: string;
          internacao_id: string;
          qtd_anexos: number | null;
          snapshot_autor: Json | null;
          snapshot_validador: Json | null;
          status: Database["public"]["Enums"]["status_evolucao"];
          texto_livre: string;
          validada_em: string | null;
          validada_por: string | null;
          vias_impressas: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "evolucoes_adendo_de_fkey";
            columns: ["adendo_de"];
            isOneToOne: false;
            referencedRelation: "evolucoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_adendo_de_fkey";
            columns: ["adendo_de"];
            isOneToOne: false;
            referencedRelation: "vw_evolucoes_timeline";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_devolvida_por_fkey";
            columns: ["devolvida_por"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_devolvida_por_fkey";
            columns: ["devolvida_por"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "internacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "vw_internacoes_lista";
            referencedColumns: ["internacao_id"];
          },
          {
            foreignKeyName: "evolucoes_validada_por_fkey";
            columns: ["validada_por"];
            isOneToOne: false;
            referencedRelation: "profissionais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolucoes_validada_por_fkey";
            columns: ["validada_por"];
            isOneToOne: false;
            referencedRelation: "vw_profissionais_publico";
            referencedColumns: ["id"];
          },
        ];
      };
      vw_internacoes_lista: {
        Row: {
          admitido_em: string;
          alta_em: string | null;
          convenio: string;
          data_nascimento: string;
          equipe_id: string;
          equipe_nome: string;
          internacao_id: string;
          leito_ala: string;
          medico_responsavel_nome: string | null;
          nome: string;
          paciente_id: string;
          status: Database["public"]["Enums"]["status_internacao"];
          status_hoje: string | null;
          tipo_alta: Database["public"]["Enums"]["tipo_alta"] | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "internacoes_equipe_id_fkey";
            columns: ["equipe_id"];
            isOneToOne: false;
            referencedRelation: "equipes";
            referencedColumns: ["id"];
          },
        ];
      };
      vw_profissionais_publico: {
        Row: {
          ativo: boolean;
          categoria: Database["public"]["Enums"]["categoria_evolucao"] | null;
          conselho: string | null;
          id: string;
          nome: string;
          numero_conselho: string | null;
          perfil: Database["public"]["Enums"]["perfil_profissional"];
          uf_conselho: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean | null;
          categoria?: Database["public"]["Enums"]["categoria_evolucao"] | null;
          conselho?: string | null;
          id?: string | null;
          nome?: string | null;
          numero_conselho?: string | null;
          perfil?: Database["public"]["Enums"]["perfil_profissional"] | null;
          uf_conselho?: string | null;
        };
        Update: {
          ativo?: boolean | null;
          categoria?: Database["public"]["Enums"]["categoria_evolucao"] | null;
          conselho?: string | null;
          id?: string | null;
          nome?: string | null;
          numero_conselho?: string | null;
          perfil?: Database["public"]["Enums"]["perfil_profissional"] | null;
          uf_conselho?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_atualizar_profissional: {
        Args: {
          p_categoria: Database["public"]["Enums"]["categoria_evolucao"];
          p_conselho: string;
          p_id: string;
          p_nome: string;
          p_numero: string;
          p_perfil: Database["public"]["Enums"]["perfil_profissional"];
          p_uf: string;
        };
        Returns: undefined;
      };
      admin_definir_ativo: { Args: { p_ativo: boolean; p_id: string }; Returns: undefined };
      admin_desvincular: {
        Args: { p_equipe_id: string; p_profissional_id: string };
        Returns: undefined;
      };
      admin_listar_profissionais: {
        Args: Record<PropertyKey, never>;
        Returns: {
          ativo: boolean;
          categoria: Database["public"]["Enums"]["categoria_evolucao"];
          conselho: string;
          convite_pendente: boolean;
          email: string;
          equipe_ids: string[];
          id: string;
          nome: string;
          numero_conselho: string;
          perfil: Database["public"]["Enums"]["perfil_profissional"];
          uf_conselho: string;
        }[];
      };
      admin_revogar_sessoes: { Args: { p_id: string }; Returns: undefined };
      admin_salvar_equipe: {
        Args: { p_ativo: boolean; p_id: string; p_nome: string };
        Returns: string;
      };
      admin_vincular: {
        Args: { p_equipe_id: string; p_profissional_id: string };
        Returns: undefined;
      };
      admitir_paciente: {
        Args: {
          p_comorbidades: string;
          p_convenio: string;
          p_data_nascimento: string;
          p_diagnostico_inicial: string;
          p_equipe_id: string;
          p_leito_ala: string;
          p_muc: string;
          p_nome: string;
        };
        Returns: string;
      };
      confirmar_anexo: { Args: { p_anexo_id: string }; Returns: undefined };
      criar_adendo: { Args: { p_evolucao_id: string }; Returns: string };
      criar_anexo: {
        Args: {
          p_data_exame: string;
          p_descricao: string;
          p_evolucao_id: string;
          p_mime: string;
          p_sha256: string;
          p_tamanho_bytes: number;
          p_tipo: Database["public"]["Enums"]["tipo_anexo"];
        };
        Returns: {
          id: string;
          storage_path: string;
        }[];
      };
      dar_alta: {
        Args: {
          p_alta_em?: string;
          p_internacao_id: string;
          p_resumo: string;
          p_tipo: Database["public"]["Enums"]["tipo_alta"];
        };
        Returns: undefined;
      };
      descartar_rascunho: { Args: { p_evolucao_id: string }; Returns: undefined };
      devolver_evolucao: { Args: { p_evolucao_id: string; p_motivo: string }; Returns: undefined };
      enviar_evolucao: { Args: { p_evolucao_id: string }; Returns: undefined };
      finalizar_evolucao: { Args: { p_evolucao_id: string }; Returns: string };
      marcar_lida: { Args: { p_id: string }; Returns: undefined };
      marcar_todas_lidas: { Args: Record<PropertyKey, never>; Returns: undefined };
      registrar_acesso: { Args: { p_acao: string; p_internacao_id: string }; Returns: undefined };
      registrar_assinatura_push: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string };
        Returns: undefined;
      };
      registrar_impressao: { Args: { p_evolucao_id: string }; Returns: number };
      registrar_impressoes: {
        Args: { p_chave?: string; p_ids: string[] };
        Returns: {
          evolucao_id: string;
          via: number;
        }[];
      };
      remover_anexo: { Args: { p_anexo_id: string }; Returns: undefined };
      remover_assinatura_push: { Args: { p_endpoint: string }; Returns: undefined };
      salvar_preferencias_notificacao: {
        Args: { p_push_devolvida: boolean; p_push_validacao: boolean };
        Returns: undefined;
      };
      salvar_rascunho: {
        Args: { p_dados: Json; p_internacao_id: string; p_texto_livre: string };
        Returns: {
          atualizado_em: string;
          id: string;
        }[];
      };
      trocar_leito: { Args: { p_internacao_id: string; p_leito_ala: string }; Returns: undefined };
      validar_evolucao: { Args: { p_evolucao_id: string }; Returns: string };
    };
    Enums: {
      categoria_evolucao:
        | "medica"
        | "enfermagem"
        | "fisioterapia"
        | "nutricao"
        | "psicologia"
        | "fonoaudiologia"
        | "servico_social";
      perfil_profissional:
        | "medico"
        | "residente"
        | "multiprofissional"
        | "recepcao"
        | "auditoria"
        | "admin"
        | "academico";
      status_evolucao: "RASCUNHO" | "AGUARDANDO_VALIDACAO" | "FINALIZADA";
      status_internacao: "INTERNADO" | "ALTA";
      tipo_alta: "MELHORADA" | "CURADA" | "A_PEDIDO" | "TRANSFERENCIA" | "EVASAO" | "OBITO";
      tipo_anexo: "LABORATORIO" | "IMAGEM" | "ECG" | "OUTRO";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      categoria_evolucao: [
        "medica",
        "enfermagem",
        "fisioterapia",
        "nutricao",
        "psicologia",
        "fonoaudiologia",
        "servico_social",
      ],
      perfil_profissional: [
        "medico",
        "residente",
        "multiprofissional",
        "recepcao",
        "auditoria",
        "admin",
        "academico",
      ],
      status_evolucao: ["RASCUNHO", "AGUARDANDO_VALIDACAO", "FINALIZADA"],
      status_internacao: ["INTERNADO", "ALTA"],
      tipo_alta: ["MELHORADA", "CURADA", "A_PEDIDO", "TRANSFERENCIA", "EVASAO", "OBITO"],
      tipo_anexo: ["LABORATORIO", "IMAGEM", "ECG", "OUTRO"],
    },
  },
} as const;
