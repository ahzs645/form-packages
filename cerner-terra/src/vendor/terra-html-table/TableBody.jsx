import { withDefaults } from '../../runtime/with-defaults';
import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  /**
   * The child TableRows to render within the body.
   */
  children: PropTypes.node,
};

const defaultProps = {
  children: [],
};

const TableBody = ({
  children,
  ...customProps
}) => (
  <tbody {...customProps}>
    {children}
  </tbody>
);

TableBody.propTypes = propTypes;

export default withDefaults(TableBody, defaultProps);
