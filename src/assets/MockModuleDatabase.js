export const rawSupabaseData = [
  // ==========================================
  // LEVEL 1000 MODULES
  // ==========================================
  {
    id: 'dsa1101',
    label: 'DSA1101',
    level: 1000,
    description: 'Introduction to Data Science',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major']
  },
  {
    id: 'ma1521',
    label: 'MA1521',
    level: 1000,
    description: 'Calculus for Computing',
    majors: ['BZA-Major'],
    compulsoryFor: ['BZA-Major']
  },
  {
    id: 'ma1522',
    label: 'MA1522',
    level: 1000,
    description: 'Linear Algebra for Computing',
    majors: ['BZA-Major'],
    compulsoryFor: ['BZA-Major']
  },
  
  // ==========================================
  // LEVEL 2000 MODULES
  // ==========================================
  {
    id: 'cs2040',
    label: 'CS2040',
    level: 2000,
    description: 'Data Structures and Algorithms',
    majors: ['DSA-Major', 'BZA-Major'], // Shared module
    compulsoryFor: ['DSA-Major', 'BZA-Major'] // Compulsory for both
  },
  {
    id: 'cs2030',
    label: 'CS2030',
    level: 2000,
    description: 'Programming Methodology II',
    majors: ['BZA-Major'],
    compulsoryFor: ['BZA-Major']
  },
  {
    id: 'bt2101',
    label: 'BT2101',
    level: 2000,
    description: 'Econometrics Modeling for Business Analytics',
    majors: ['BZA-Major'],
    compulsoryFor: ['BZA-Major']
  },
  {
    id: 'bt2102',
    label: 'BT2102',
    level: 2000,
    description: 'Data Management and Visualisation',
    majors: ['BZA-Major'],
    compulsoryFor: ['BZA-Major']
  },
  {
    id: 'is2101',
    label: 'IS2101',
    level: 2000,
    description: 'Business and Technical Communication',
    majors: ['BZA-Major'],
    compulsoryFor: ['BZA-Major']
  },
  {
    id: 'st2334',
    label: 'ST2334',
    level: 2000,
    description: 'Probability and Statistics',
    majors: ['BZA-Major'],
    compulsoryFor: ['BZA-Major']
  },
  {
    id: 'dsa2101',
    label: 'DSA2101',
    level: 2000,
    description: 'Essential Data Analytics Tools: Data Visualisation',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major']
  },
  {
    id: 'dsa2102',
    label: 'DSA2102',
    level: 2000,
    description: 'Essential Data Analytics Tools: Numerical Computation',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major']
  },
  {
    id: 'ma2001',
    label: 'MA2001',
    level: 2000,
    description: 'Linear Algebra I',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major']
  },
  {
    id: 'ma2002',
    label: 'MA2002',
    level: 2000,
    description: 'Calculus',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major']
  },
  {
    id: 'ma2104',
    label: 'MA2104',
    level: 2000,
    description: 'Multivariable Calculus',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    orGroupId: 'ma2104_ma2311_choice' 
  },
  {
    id: 'ma2311',
    label: 'MA2311',
    level: 2000,
    description: 'Techniques in Advanced Calculus',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    orGroupId: 'ma2104_ma2311_choice'
  },
  {
    id: 'st2131',
    label: 'ST2131',
    level: 2000,
    description: 'Probability',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major']
  },
  {
    id: 'st2132',
    label: 'ST2132',
    level: 2000,
    description: 'Mathematical Statistics',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major']
  },

  // ==========================================
  // LEVEL 3000 MODULES
  // ==========================================
  {
    id: 'bt3103',
    label: 'BT3103',
    level: 3000,
    description: 'Application Systems Development for Business Analytics',
    majors: ['BZA-Major'],
    compulsoryFor: ['BZA-Major']
  },
  {
    id: 'is3103',
    label: 'IS3103',
    level: 3000,
    description: 'Information Systems Leadership and Communication',
    majors: ['BZA-Major'],
    compulsoryFor: ['BZA-Major']
  },
  {
    id: 'cs3244',
    label: 'CS3244',
    level: 3000,
    description: 'Machine Learning',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major']
  },
  {
    id: 'dsa3101',
    label: 'DSA3101',
    level: 3000,
    description: 'Data Science in Practice',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major']
  },
  {
    id: 'dsa3102',
    label: 'DSA3102',
    level: 3000,
    description: 'Essential Data Analytics Tools: Convex Optimisation',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major']
  },
  {
    id: 'st3131',
    label: 'ST3131',
    level: 3000,
    description: 'Regression Analysis',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major']
  },

  // ==========================================
  // LEVEL 4000 MODULES
  // ==========================================
  {
    id: 'bt4103',
    label: 'BT4103',
    level: 4000,
    description: 'Business Analytics Capstone Project',
    majors: ['BZA-Major'],
    compulsoryFor: ['BZA-Major']
  },
  {
    id: 'bt4101',
    label: 'BT4101',
    level: 4000,
    description: 'B.Sc. Dissertation or Industry Experience Requirement',
    majors: ['BZA-Major'],
    compulsoryFor: ['BZA-Major']
  },
  {
    id: 'chs_writing_pillar',
    label: 'Writing',
    level: 1000,
    description: 'Select one Writing module',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isPillar: true,
    options: [
      { id: 'fas1101', label: 'FAS1101', description: 'Writing Academically: Arts and Social Sciences' },
      { id: 'sp1541', label: 'SP1541', description: 'Exploring Science Communication through Writing' },
      { id: 'sp1541x', label: 'SP1541X', description: 'Exploring Science Communication through Writing (Special)' },
      { id: 'sp2271', label: 'SP2271', description: 'Science Communication on Contemporary Issues' }
    ]
  },
  {
    id: 'chs_data_literacy_pillar',
    label: 'Data Literacy',
    level: 1000,
    description: 'Select one Data Literacy module',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isPillar: true,
    options: [
      { id: 'gea1000', label: 'GEA1000', description: 'Quantitative Reasoning with Data' },
      { id: 'dsa1101', label: 'DSA1101', description: 'Introduction to Data Science' },
      { id: 'st1131', label: 'ST1131', description: 'Introduction to Statistical Theory' },
      { id: 'dse1101', label: 'DSE1101', description: 'Introduction to Data Science and Economics' },
      { id: 'bt1101', label: 'BT1101', description: 'Introduction to Business Analytics' }
    ]
  },
  {
    id: 'chs_communities_engagement',
    label: 'Communities & Engagement',
    level: 1000,
    description: 'Select one module from the Communities and Engagement basket',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isPillar: true,
    options: [
      { id: 'cne_basket_1', label: 'GEN2001', description: 'Value-driven Community Engagement' },
      { id: 'cne_basket_2', label: 'GEN2002', description: 'Community Engagement in Action' }
    ]
  },
  {
    id: 'chs_ai_pillar',
    label: 'Artificial Intelligence',
    level: 1000,
    description: 'Select one Artificial Intelligence module',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isPillar: true,
    options: [
      { id: 'hs1501', label: 'HS1501', description: 'Artificial Intelligence and Society' },
      { id: 'hs1502', label: 'HS1502', description: 'Foundations of Artificial Intelligence' },
      { id: 'hs1503', label: 'HS1503', description: 'Applications of Artificial Intelligence' },
      { id: 'it1244', label: 'IT1244', description: 'Artificial Intelligence: Technology and Impact' },
      { id: 'cs2109s', label: 'CS2109S', description: 'Introduction to Machine Learning and AI' }
    ]
  },
  {
    id: 'dtk1234',
    label: 'DTK1234',
    level: 1000,
    description: 'Design Thinking',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isSingleModulePillar: true, // Identifies this standalone module as a pillar
    pillarLabel: 'Design Thinking'
  },
  {
    id: 'chs_digital_literacy_pillar',
    label: 'Digital Literacy',
    level: 1000,
    description: 'Select one Digital Literacy module',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isPillar: true,
    options: [
      { id: 'gei1001', label: 'GEI1001', description: 'Computational Reasoning' },
      { id: 'gei1002', label: 'GEI1002', description: 'Digital Innovations' },
      { id: 'nm2207', label: 'NM2207', description: 'Computational Media Literacy' },
      { id: 'cs1010x', label: 'CS1010X', description: 'Programming Methodology' },
      { id: 'cs1101s', label: 'CS1101S', description: 'Programming Methodology (Scheme)' },
      { id: 'cos1000', label: 'COS1000', description: 'Computational Science' },
      { id: 'cm3267', label: 'CM3267', description: 'Computational Chemistry' },
      { id: 'lsm2302', label: 'LSM2302', description: 'Computational Biology' },
      { id: 'zb2201', label: 'ZB2201', description: 'Computational Structural Biology' },
      { id: 'sp2273', label: 'SP2273', description: 'Working with Data in the Sciences' },
      { id: 'utc2851', label: 'UTC2851', description: 'UTCP Digital Literacy Elective I' },
      { id: 'utc2852', label: 'UTC2852', description: 'UTCP Digital Literacy Elective II' }
    ]
  },

  // ==========================================
  // 5 INTEGRATED COURSES
  // ==========================================
  {
    id: 'hsh1000',
    label: 'HSH1000',
    level: 1000,
    description: 'Humanities: The Human Condition',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isSingleModulePillar: true,
    pillarLabel: 'Humanities'
  },
  {
    id: 'hss1000',
    label: 'HSS1000',
    level: 1000,
    description: 'Social Sciences: Understanding Social Complexity',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isSingleModulePillar: true,
    pillarLabel: 'Social Sciences'
  },
  {
    id: 'hsa1000',
    label: 'HSA1000',
    level: 1000,
    description: 'Asian Studies: Interconnections',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isSingleModulePillar: true,
    pillarLabel: 'Asian Studies'
  },
  {
    id: 'chs_scientific_inquiry_1',
    label: 'Scientific Inquiry I',
    level: 1000,
    description: 'Select one Scientific Inquiry I module',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isPillar: true,
    options: [
      { id: 'hsi1000', label: 'HSI1000', description: 'How Science Works, Why It Matters' },
      { id: 'sp2274', label: 'SP2274', description: 'Methods in Science' }
    ]
  },
  {
    id: 'chs_scientific_inquiry_2',
    label: 'Scientific Inquiry II',
    level: 2000,
    description: 'Select one Scientific Inquiry II module',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isPillar: true,
    options: [
      { id: 'hsi2001', label: 'HSI2001', description: 'Scientific Inquiry II: Physical Sciences' },
      { id: 'hsi2002', label: 'HSI2002', description: 'Scientific Inquiry II: Life Sciences' }
    ]
  },

  // ==========================================
  // 2 INTER-DISCIPLINARY COURSES
  // ==========================================
  {
    id: 'chs_course_choice_1',
    label: 'Course Choice I',
    level: 2000,
    description: 'Select an Interdisciplinary Course (HS29xx)',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isPillar: true,
    options: [
      { id: 'hs2901', label: 'HS2901', description: 'Interdisciplinary General Education Course A' },
      { id: 'hs2902', label: 'HS2902', description: 'Interdisciplinary General Education Course B' }
    ]
  },
  {
    id: 'chs_course_choice_2',
    label: 'Course Choice II',
    level: 2000,
    description: 'Select a secondary Interdisciplinary Course (HS29xx)',
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isPillar: true,
    options: [
      { id: 'hs2903', label: 'HS2903', description: 'Interdisciplinary General Education Course C' },
      { id: 'hs2904', label: 'HS2904', description: 'Interdisciplinary General Education Course D' }
    ]
  },

  // ==========================================
  // LEVEL 4000 COMPLEX GRADUATION PATHWAY
  // ==========================================
  {
    id: 'dsa_l4000_pathway',
    label: 'Level 4000 Requirement (8 Units)',
    level: 4000,
    majors: ['DSA-Major'],
    compulsoryFor: ['DSA-Major'],
    isLevel4000Pathway: true, // Flags the specialized rendering block
    
    // Track Option A Data Structure
    optionA: {
      basket1: {
        id: 'dsa421x_basket',
        label: 'Basket 1 (DSA421x / FinTech)',
        options: [
          { id: 'dsa4211', label: 'DSA4211', description: 'Database Applications' },
          { id: 'dsa4212', label: 'DSA4212', description: 'Advanced Data Science' },
          { id: 'dse4211', label: 'DSE4211', description: 'Digital Currencies' },
          { id: 'qf4211', label: 'QF4211', description: 'Digital Currencies' },
          { id: 'dse4212', label: 'DSE4212', description: 'Data Science in FinTech' },
          { id: 'qf4212', label: 'QF4212', description: 'Data Science in FinTech' }
        ]
      },
      basket2: {
        id: 'dsa426x_basket',
        label: 'Basket 2 (DSA426x)',
        options: [
          { id: 'dsa4261', label: 'DSA4261', description: 'Data Science Computing' },
          { id: 'dsa4262', label: 'DSA4262', description: 'Stochastic Processes' },
          { id: 'dsa4263', label: 'DSA4263', description: 'Temporal and Spatial Data Analysis' }
        ]
      }
    },

    // Track Option B Data Structure
    optionB: {
      id: 'dsa4288_honours_basket',
      label: 'Honours Project Variants',
      options: [
        { id: 'dsa4288', label: 'DSA4288', description: 'Honours Project in Data Science and Analytics' },
        { id: 'dsa4288m', label: 'DSA4288M', description: 'Honours Project in DSA (Operations Research)' },
        { id: 'dsa4288s', label: 'DSA4288S', description: 'Honours Project in DSA (Statistical Methodology)' }
      ]
    }
  }

];