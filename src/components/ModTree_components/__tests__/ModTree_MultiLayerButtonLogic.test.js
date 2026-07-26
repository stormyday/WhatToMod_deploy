import { beforeEach, describe, expect, it } from 'vitest';
import {
  analyzeLevel4000Pathway,
  clearLevel4000ActiveTracks,
} from '../ModTree_MultiLayerButtonLogic';

describe('analyzeLevel4000Pathway', () => {
  beforeEach(() => {
    clearLevel4000ActiveTracks('CS4100');
    clearLevel4000ActiveTracks('CS4200');
  });

  it('marks a nested pathway complete when the selected module satisfies the tree', () => {
    const nodeData = {
      id: 'CS4100',
      options: [
        {
          pathwayName: 'Systems',
          children: [
            {
              pillarName: 'Core',
              children: [
                {
                  moduleName: 'Operating Systems',
                  id: 'CS4100',
                },
              ],
            },
          ],
        },
      ],
    };

    const analysis = analyzeLevel4000Pathway(nodeData, ['CS4100']);

    expect(analysis).toMatchObject({
      kind: 'group',
      groupType: 'pathway',
      complete: true,
      activeIndex: 0,
      autoCollapsed: true,
    });
    expect(analysis.nodes).toHaveLength(1);
    expect(analysis.nodes[0]).toMatchObject({
      type: 'pathway',
      complete: true,
      childrenGroup: expect.objectContaining({
        kind: 'group',
        groupType: 'pillar',
        complete: true,
      }),
    });
  });

  it('stays incomplete when the required module is missing', () => {
    const analysis = analyzeLevel4000Pathway(
      {
        id: 'CS4100',
        options: [
          {
            pathwayName: 'Systems',
            children: [
              {
                pillarName: 'Core',
                children: [
                  {
                    moduleName: 'Operating Systems',
                    id: 'CS4100',
                  },
                ],
              },
            ],
          },
        ],
      },
      []
    );

    expect(analysis.complete).toBe(false);
    expect(analysis.hasError).toBe(false);
  });

  it('flags malformed mixed node trees', () => {
    const analysis = analyzeLevel4000Pathway({
      id: 'CS4100',
      options: [
        {
          pathwayName: 'Pathway A',
          children: [],
        },
        {
          moduleName: 'Standalone Module',
          id: 'CS4100',
        },
      ],
    });

    expect(analysis.kind).toBe('mixed');
    expect(analysis.hasError).toBe(true);
    expect(analysis.complete).toBe(false);
    expect(analysis.message).toMatch(/mixed node types/i);
  });
});
