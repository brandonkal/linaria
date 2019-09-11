import React from 'react';
// @ts-ignore
import { styled } from '@brandonkal/linaria/react';

import getIconType from './getIcon';

type variant = 'success' | 'warning' | 'error' | 'info';

interface AlertProps {
  variant$?: variant;
  banner$?: boolean;
  content$?: string;
  title$: string;
  showIcon$?: boolean;
  onClose?: () => void;
}

const CloseIcon = styled.div`
  top: 15px;
  color: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  &:hover {
    color: rgba(0, 0, 0, 0.75);
  }
`;
const Content = styled.div`
  font-size: 14px;
`;
const Header = styled.div`
  color: red;
  font-weight: 700;
`;

interface RootProps {
  banner$?: boolean;
  content$?: string;
  variant$?: variant;
  header$?: string;
  closed$: boolean;
  showIcon$: boolean;
}

export const Root = (p => styled.div<RootProps>`
  position: relative;
  margin: 0;
  padding: ${p.showIcon$ ? '8px 15px 8px 37px' : '8px 15px'};
  color: rgba(0, 0, 0, 0.65);
  font-size: 14px;

  &${[p.banner$]} {
    margin-bottom: 0;
    border: 0;
  }

  &${[p.variant$ === 'success']} {
    background-color: #f6ffed;
    border: 1px solid #b7eb8f;
  }
`)({} as RootProps);

export function Alert({ onClose, showIcon$ = true, ...props }: AlertProps) {
  const [closed$, setClosed] = React.useState(false);
  let ref = React.createRef<HTMLDivElement>();

  function handleClose(): void {
    let node = ref.current;
    if (node) {
      let styles = window.getComputedStyle(node);
      node.style.height = styles.height;
      node.style.marginBottom = styles.marginBottom;
    }
    setClosed(true);
    onClose && onClose();
  }

  const Icon = getIconType(props.variant$, !props.content$);

  return (
    <Root ref={ref} showIcon$={showIcon$} closed$={closed$} {...props}>
      {showIcon$ && <Icon />}
      {onClose && <CloseIcon onClick={handleClose}>&times;</CloseIcon>}
      <Header>{props.title$}</Header>
      {props.content$ && <Content>{props.content$}</Content>}
    </Root>
  );
}

Alert.cls = Root.__linaria.className;
