import { Jurisdiction } from '../types';

export interface ObjectionGround {
  ground: string;
  description: string;
  ruleReference: string;
  cureOptions: string[];
}

export interface FoundationRequirement {
  element: string;
  description: string;
  requiredFor: string[];
}

export interface HearsayException {
  name: string;
  ruleNumber: string;
  requirements: string[];
  applicableIn: Jurisdiction[];
}

export const OBJECTION_GROUNDS: ObjectionGround[] = [
  {
    ground: 'hearsay',
    description: 'Out-of-court statement offered for the truth of the matter asserted',
    ruleReference: 'FRE 801-807',
    cureOptions: ['Establish exception', 'Offer for non-hearsay purpose', 'Lay foundation for exception']
  },
  {
    ground: 'leading',
    description: 'Question suggests the desired answer',
    ruleReference: 'FRE 611(c)',
    cureOptions: ['Rephrase as open-ended question', 'Establish hostile witness status']
  },
  {
    ground: 'speculation',
    description: 'Witness asked to guess or speculate',
    ruleReference: 'FRE 602, 701',
    cureOptions: ['Establish personal knowledge', 'Rephrase to facts within knowledge']
  },
  {
    ground: 'relevance',
    description: 'Evidence does not tend to prove or disprove a material fact',
    ruleReference: 'FRE 401-403',
    cureOptions: ['Explain probative value', 'Address prejudice vs. probative balance']
  },
  {
    ground: 'best_evidence',
    description: 'Original document required but not produced',
    ruleReference: 'FRE 1001-1008',
    cureOptions: ['Produce original', 'Establish exception', 'Explain unavailability']
  },
  {
    ground: 'authentication',
    description: 'Evidence not properly authenticated',
    ruleReference: 'FRE 901-902',
    cureOptions: ['Lay foundation through witness', 'Submit to self-authentication process']
  },
  {
    ground: 'character',
    description: 'Improper character evidence',
    ruleReference: 'FRE 404-405',
    cureOptions: ['Establish proper purpose', 'Limit to permissible use']
  },
  {
    ground: 'privileged',
    description: 'Protected by attorney-client, doctor-patient, or other privilege',
    ruleReference: 'FRE 501-502',
    cureOptions: ['Establish waiver', 'Show crime-fraud exception does not apply']
  }
];

export const FOUNDATION_REQUIREMENTS: FoundationRequirement[] = [
  {
    element: 'personal_knowledge',
    description: 'Witness has firsthand knowledge of the events',
    requiredFor: ['lay_opinion', 'fact_testimony']
  },
  {
    element: 'authentication',
    description: 'Evidence is what the proponent claims it to be',
    requiredFor: ['documents', 'photographs', 'recordings', 'physical_evidence']
  },
  {
    element: 'chain_of_custody',
    description: 'Unbroken chain of possession and control',
    requiredFor: ['physical_evidence', 'biological_samples', 'drugs']
  },
  {
    element: 'expert_qualification',
    description: 'Witness qualified as expert by knowledge, skill, experience, training, or education',
    requiredFor: ['expert_testimony', 'scientific_evidence']
  },
  {
    element: 'reliability',
    description: 'Methodology is scientifically reliable and generally accepted',
    requiredFor: ['novel_scientific_evidence', 'technical_evidence']
  }
];

export const HEARSAY_EXCEPTIONS: HearsayException[] = [
  {
    name: 'Present Sense Impression',
    ruleNumber: 'FRE 803(1)',
    requirements: ['Statement describing event', 'Made while perceiving event', 'Made immediately after event'],
    applicableIn: ['federal', 'texas', 'louisiana', 'mississippi']
  },
  {
    name: 'Excited Utterance',
    ruleNumber: 'FRE 803(2)',
    requirements: ['Startling event occurred', 'Statement relates to event', 'Made while under stress'],
    applicableIn: ['federal', 'texas', 'louisiana', 'mississippi']
  },
  {
    name: 'Then-Existing Mental, Emotional, or Physical Condition',
    ruleNumber: 'FRE 803(3)',
    requirements: ['Statement of then-existing state', 'Not memory or belief to prove fact'],
    applicableIn: ['federal', 'texas', 'louisiana', 'mississippi']
  },
  {
    name: 'Statement Made for Medical Diagnosis or Treatment',
    ruleNumber: 'FRE 803(4)',
    requirements: ['Made for diagnosis or treatment', 'Reasonably pertinent to treatment'],
    applicableIn: ['federal', 'texas', 'louisiana', 'mississippi']
  },
  {
    name: 'Recorded Recollection',
    ruleNumber: 'FRE 803(5)',
    requirements: ['Witness once had knowledge', 'Record made when fresh in memory', 'Record was accurate'],
    applicableIn: ['federal', 'texas', 'louisiana', 'mississippi']
  },
  {
    name: 'Records of a Regularly Conducted Activity',
    ruleNumber: 'FRE 803(6)',
    requirements: ['Regularly conducted activity', 'Made at or near time', 'Custodian testimony'],
    applicableIn: ['federal', 'texas', 'louisiana', 'mississippi']
  },
  {
    name: 'Former Testimony',
    ruleNumber: 'FRE 804(b)(1)',
    requirements: ['Declarant unavailable', 'Prior proceeding', 'Same party/opportunity to examine'],
    applicableIn: ['federal', 'texas', 'louisiana', 'mississippi']
  },
  {
    name: 'Statement Against Interest',
    ruleNumber: 'FRE 804(b)(3)',
    requirements: ['Declarant unavailable', 'Against pecuniary, proprietary, or penal interest'],
    applicableIn: ['federal', 'texas', 'louisiana', 'mississippi']
  },
  {
    name: 'Dying Declaration',
    ruleNumber: 'FRE 804(b)(2)',
    requirements: ['Declarant believed death imminent', 'Concerning cause of death', 'Homicide case'],
    applicableIn: ['federal', 'texas', 'louisiana', 'mississippi']
  },
  {
    name: 'Declaration Against Interest',
    ruleNumber: 'FRE 804(b)(3)',
    requirements: ['Declarant unavailable', 'Statement against interest', 'Circumstances indicate trustworthiness'],
    applicableIn: ['federal', 'texas', 'louisiana', 'mississippi']
  }
];

export const AUTHENTICATION_METHODS: Record<string, string[]> = {
  documents: [
    'Testimony of witness with knowledge',
    'Comparison by trier of fact',
    'Distinctive characteristics',
    'Public records',
    'Self-authentication under FRE 902'
  ],
  photographs: [
    'Testimony of photographer or witness present',
    'Recognition by person depicted',
    'Process or system producing reliable result'
  ],
  recordings: [
    'Testimony of recording operator',
    'Chain of custody testimony',
    'Voice identification',
    'Process authentication'
  ],
  digital_evidence: [
    'Testimony about system reliability',
    'Chain of custody documentation',
    'Hash value verification',
    'Metadata analysis'
  ],
  physical_evidence: [
    'Chain of custody testimony',
    'Testimony of discoverer',
    'Distinctive characteristics',
    'Expert identification'
  ]
};

export const BEST_EVIDENCE_EXCEPTIONS: string[] = [
  'Original lost or destroyed (not in bad faith)',
  'Original cannot be obtained by judicial process',
  'Original in possession of opponent who failed to produce',
  'Collateral matter not closely related to controlling issue',
  'Public records certified under FRE 902',
  'Summaries of voluminous writings'
];

export const getObjectionGround = (ground: string): ObjectionGround | undefined => {
  return OBJECTION_GROUNDS.find(g => g.ground === ground);
};

export const getHearsayExceptions = (jurisdiction: Jurisdiction): HearsayException[] => {
  return HEARSAY_EXCEPTIONS.filter(e => e.applicableIn.includes(jurisdiction));
};

export const getAuthenticationMethods = (evidenceType: string): string[] => {
  return AUTHENTICATION_METHODS[evidenceType] || AUTHENTICATION_METHODS.documents;
};
