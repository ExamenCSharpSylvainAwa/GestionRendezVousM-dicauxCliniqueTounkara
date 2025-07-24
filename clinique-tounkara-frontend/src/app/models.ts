export interface Permission {
  id?: number;
  name: string;
  description?: string;
}

export interface Role {
  id?: number;
  name: string;
  permissions: Permission[];
}