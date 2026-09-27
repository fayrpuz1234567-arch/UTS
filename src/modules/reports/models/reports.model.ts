export interface Report {
  id: string;
  name: string;
  nameAr: string;
  module: string;
  type: 'table' | 'chart' | 'summary' | 'analytics';
  parameters: Record<string, any>;
  columns: string[];
  filters: Record<string, any>;
  sorting: Record<string, 'asc' | 'desc'>;
  chartConfig?: {
    type: 'bar' | 'pie' | 'line' | 'area' | 'donut' | 'heatmap';
    xAxis?: string;
    yAxis?: string;
    title?: string;
  };
  isPublic: boolean;
  userId: string;
  schedule?: {
    enabled: boolean;
    cronExpression: string;
    recipients: string[];
    formats: ('pdf' | 'excel' | 'csv')[];
  };
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
}

export interface CreateReportDTO {
  name: string;
  nameAr: string;
  module: string;
  type: 'table' | 'chart' | 'summary' | 'analytics';
  parameters: Record<string, any>;
  columns: string[];
  filters: Record<string, any>;
  sorting: Record<string, 'asc' | 'desc'>;
  chartConfig?: any;
  isPublic?: boolean;
  schedule?: any;
}

export interface GenerateReportDTO {
  reportId: string;
  format: 'pdf' | 'excel' | 'csv';
  dateRange?: {
    from: string;
    to: string;
  };
  additionalFilters?: Record<string, any>;
}