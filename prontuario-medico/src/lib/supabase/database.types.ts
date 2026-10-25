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
          enviada_em: string | null;
          finalizada_em: string | null;
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
          enviada_em?: string | null;
          finalizada_em?: string | null;
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
          enviada_em?: string | null;
          finalizada_em?: string | null;
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
            foreignKeyName: "evolucoes_internacao_id_fkey";
            columns: ["internacao_id"];
            isOneToOne: false;
            referencedRelation: "internacoes";
            referencedColumns: ["id"];
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
          evolucao_id: string;
          id: string;
          impresso_em: string;
          impresso_por: string;
          via: number;
        };
        ComputedFields: never;
        Insert: {
          evolucao_id: string;
          id?: string;
          impresso_em?: string;
          impresso_por: string;
          via: number;
        };
        Update: {
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
          comorbidades: string;
          diagnostico_inicial: string;
          equipe_id: string;
          id: string;
          leito_ala: string;
          medico_responsavel_id: string;
          motivo_alta: string | null;
          muc: string;
          paciente_id: string;
          status: Database["public"]["Enums"]["status_internacao"];
        };
        ComputedFields: never;
        Insert: {
          admitido_em?: string;
          alta_em?: string | null;
          alta_por?: string | null;
          comorbidades: string;
          diagnostico_inicial: string;
          equipe_id: string;
          id?: string;
          leito_ala: string;
          medico_responsavel_id: string;
          motivo_alta?: string | null;
          muc: string;
          paciente_id: string;
          status?: Database["public"]["Enums"]["status_internacao"];
        };
        Update: {
          admitido_em?: string;
          alta_em?: string | null;
          alta_por?: string | null;
          comorbidades?: string;
          diagnostico_inicial?: string;
          equipe_id?: string;
          id?: string;
          leito_ala?: string;
          medico_responsavel_id?: string;
          motivo_alta?: string | null;
          muc?: string;
          paciente_id?: string;
          status?: Database["public"]["Enums"]["status_internacao"];
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
    };
    Views: {
      vw_profissionais_publico: {
        Row: {
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
          categoria?: Database["public"]["Enums"]["categoria_evolucao"] | null;
          conselho?: string | null;
          id?: string | null;
          nome?: string | null;
          numero_conselho?: string | null;
          perfil?: Database["public"]["Enums"]["perfil_profissional"] | null;
          uf_conselho?: string | null;
        };
        Update: {
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
      [_ in never]: never;
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
        | "admin";
      status_evolucao: "RASCUNHO" | "AGUARDANDO_VALIDACAO" | "FINALIZADA";
      status_internacao: "INTERNADO" | "ALTA";
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
      ],
      status_evolucao: ["RASCUNHO", "AGUARDANDO_VALIDACAO", "FINALIZADA"],
      status_internacao: ["INTERNADO", "ALTA"],
    },
  },
} as const;
