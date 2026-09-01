import { withDefaults } from '../../../runtime/with-defaults';
import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  /**
   * Prop to determine whether or not the container height is bounded.
   */
  isHeightBounded: PropTypes.bool,
  /**
   * Prop to determine whether or not the container width is bounded.
   */
  isWidthBounded: PropTypes.bool,
  /**
   * A callback function to execute when a key is pressed.
   */
  onKeyDown: PropTypes.func,
  /**
   * Components to be included in the popup container.
   */
  children: PropTypes.node,
}

const defaultProps = {
  isHeightBounded: false,
  isWidthBounded: false,
}

const PopupContent = React.forwardRef((props, ref) => {
  return (
    <div
      ref={ref}
      onKeyDown={props.onKeyDown}
    >
      {props.children}
    </div>
  );
});

PopupContent.propTypes = propTypes;

export default withDefaults(PopupContent, defaultProps);
