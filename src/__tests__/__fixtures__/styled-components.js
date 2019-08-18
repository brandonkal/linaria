import { styled } from '@brandonkal/linaria/react';

export const T1 = styled.h1`
  background: #111;
  width: ${() => window.innerWidth * 0.5}px;
`;
export const T2 = styled.h2`
  background: #222;
  &${[p => p.primary$]} {
    color: red;
  }
`;
export const T3 = styled.h3`
  ${T2} {
    background: #333;
  }
`;
