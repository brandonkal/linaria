import React from 'react';
import 'core-js';
//@ts-ignore
import { styled } from '@brandonkal/linaria/react';
import render from 'react-test-renderer';
// @ts-ignore -- uses webpack alias
import { Alert, typesOnly } from 'components';

const Container = styled.div`
  ${Alert} {
    background: pink;
    padding: 1rem;
  }
  margin-bottom: 10px;
`;

const toLog: typesOnly = 'hello';

render.create(
  <Container>
    <Alert
      variant$="error"
      title$="Error"
      onClose={() => console.log('You closed the message')}
    />
    <Alert variant$="error" title$="Error" />
  </Container>
);
