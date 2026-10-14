import type { CscaSubjectCode } from './courses';

export type VideoCommerceProductType = 'video' | 'combo';
export type VideoCommerceProductStatus = 'draft' | 'active' | 'archived';
export type VideoDurationMode = 'unconfigured' | 'days' | 'lifetime';

interface ProductBase {
  id: number;
  type: VideoCommerceProductType;
  name: string;
  description: string;
  features: string[];
  status: VideoCommerceProductStatus;
  priceVnd: number | null;
  originalPriceVnd: number | null;
  sortOrder: number;
  configurationIssues: string[];
  /** Foundation APIs cannot sell or grant packages yet. */
  canPurchase: false;
}

export interface VideoPackageDto extends ProductBase {
  type: 'video';
  durationMode: VideoDurationMode;
  durationDays: number | null;
  allowedSubjects: CscaSubjectCode[];
  requiresSubjectChoice: boolean;
  courseIds: number[];
}

export interface ComboPackageDto extends ProductBase {
  type: 'combo';
  vipPackageId: number | null;
  videoPackageId: number | null;
  vipDurationDays: number | null;
}

export type VideoCommerceProductDto = VideoPackageDto | ComboPackageDto;

export interface VideoCommerceCatalogDto {
  items: VideoCommerceProductDto[];
  page: number;
  limit: number;
  hasMore: boolean;
  checkoutAvailable: false;
}

type DraftBase = {
  name: string;
  description?: string;
  features?: string[];
  status?: 'draft';
  priceVnd?: number | null;
  originalPriceVnd?: number | null;
  sortOrder?: number;
};

export type VideoPackageDraftInput = DraftBase & {
  durationMode?: VideoDurationMode;
  durationDays?: number | null;
  allowedSubjects?: CscaSubjectCode[];
  requiresSubjectChoice?: boolean;
  courseIds?: number[];
};

export type ComboPackageDraftInput = DraftBase & {
  vipPackageId?: number | null;
  videoPackageId?: number | null;
  vipDurationDays?: number | null;
};

export type VideoPackageDraftPatch = Partial<VideoPackageDraftInput>;
export type ComboPackageDraftPatch = Partial<ComboPackageDraftInput>;
