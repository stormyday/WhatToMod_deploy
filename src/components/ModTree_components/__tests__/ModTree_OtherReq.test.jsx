import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CaseGRequirements from '../ModTree_OtherReq';

describe('CaseGRequirements', () => {
  it('renders notes only when the row matches the selected major', () => {
    render(
      <CaseGRequirements
        selectedMajor="CS"
        row={{
          id: 'cs_not_rendered',
          label: 'Not Rendered',
          majors: ['CS', 'IS'],
          not_rendered: ['First requirement', '', null, 'Second requirement'],
        }}
      />
    );

    expect(screen.getByText('Additional Requirements')).toBeInTheDocument();
    expect(screen.getByText('First requirement')).toBeInTheDocument();
    expect(screen.getByText('Second requirement')).toBeInTheDocument();
  });

  it('returns nothing when the row is not applicable', () => {
    const { container } = render(
      <CaseGRequirements
        selectedMajor="EE"
        row={{
          id: 'cs_not_rendered',
          label: 'Not Rendered',
          majors: ['CS', 'IS'],
          not_rendered: ['First requirement'],
        }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
