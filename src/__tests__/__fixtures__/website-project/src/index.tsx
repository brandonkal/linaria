// import 'regenerator-runtime/runtime'

import { injectGlobal } from '@brandonkal/linaria';
import React from 'react';
import render from 'react-test-renderer';
import App from './components/App';
import constants from './styles/constants';

const root = document.getElementById('root');
render.create(<App />);

injectGlobal`
html {
  box-sizing: border-box;
  height: 100%;
  width: 100%;
}

body {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  font-family: ${constants.fontFamily};
  font-size: 20px;
  line-height: 1.42857;
}

*,
*:before,
*:after {
  box-sizing: inherit;
}
`;
