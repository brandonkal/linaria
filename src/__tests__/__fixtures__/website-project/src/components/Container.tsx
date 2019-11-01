import { styled } from '@brandonkal/linaria/react'

const Container = styled.div`
  &${[(p: any) => !p.large$]} {
    max-width: 1140px;
  }
  padding: 16px 24px;
  margin: 0 auto;
`

export default Container
