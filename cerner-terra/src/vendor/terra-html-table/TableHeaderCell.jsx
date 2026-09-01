import { withDefaults } from '../../runtime/with-defaults';
import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  /**
   * Content to be displayed for the column header
   */
  children: PropTypes.node,
};

const defaultProps = {
  children: [],
};

const TableHeaderCell = ({
  children,
  ...customProps
}) => (
  <th {...customProps}>
    {children}
  </th>
);

TableHeaderCell.propTypes = propTypes;

export default withDefaults(TableHeaderCell, defaultProps);
