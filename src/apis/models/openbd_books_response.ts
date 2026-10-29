export type OpenBDBooksResponse = (OpenBDBookItem | null)[];

export interface OpenBDBookItem {
  onix?: OpenBDOnix;
  hanmoto?: OpenBDHanmoto;
  summary?: OpenBDSummary;
}

export interface OpenBDSummary {
  isbn?: string;
  title?: string;
  volume?: string;
  series?: string;
  publisher?: string;
  pubdate?: string; // e.g. "20140408"
  cover?: string;
  author?: string;
}

export interface OpenBDOnix {
  RecordReference?: string;
  NotificationType?: string;
  ProductIdentifier?: { ProductIDType?: string; IDValue?: string };
  DescriptiveDetail?: {
    TitleDetail?: { TitleElement?: OpenBDTitleElement | OpenBDTitleElement[] };
    Contributor?: OpenBDContributor[];
    Extent?: OpenBDExtent[];
  };
  CollateralDetail?: {
    TextContent?: OpenBDTextContent[];
    SupportingResource?: OpenBDSupportingResource[];
  };
  PublishingDetail?: {
    Imprint?: { ImprintName?: string };
    Publisher?: { PublisherName?: string };
    PublishingDate?: { PublishingDateRole?: string; Date?: string }[];
  };
}

export interface OpenBDTitleElement {
  TitleElementLevel?: string;
  TitleText?: { collationkey?: string; content?: string };
  Subtitle?: { collationkey?: string; content?: string };
}

export interface OpenBDContributor {
  SequenceNumber?: string;
  ContributorRole?: string[];
  PersonName?: { collationkey?: string; content?: string };
}

export interface OpenBDExtent {
  ExtentType?: string;
  ExtentValue?: string;
  ExtentUnit?: string;
}

export interface OpenBDTextContent {
  TextType?: string;
  ContentAudience?: string;
  Text?: string;
}

export interface OpenBDSupportingResource {
  ResourceContentType?: string;
  ResourceMode?: string;
  ResourceVersion?: { ResourceForm?: string; ResourceLink?: string }[];
}

export interface OpenBDHanmoto {
  dateshuppan?: string; // e.g. "2014-04"
  kaisetsu105w?: string;
  author?: { listseq?: number | string; dokujikubun?: string }[];
}
