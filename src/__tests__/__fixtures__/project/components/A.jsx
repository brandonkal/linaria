import deadDep from 'camelcase';
import { styled } from '@brandonkal/linaria/react';

export const deadValue = deadDep('make-camel');

const objects = { font: { fontSize: 12 }, box: { border: '1px solid red' } };
const foo = k => {
  const { [k]: obj } = objects;
  return obj;
};

objects.font.fontWeight = 'bold';

export const whiteColor = '#fff';

export const Title = styled.h1`
  ${foo('font')}
  ${foo('box')}
`;
