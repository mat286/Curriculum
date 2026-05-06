import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StreamingIndicator from '../StreamingIndicator';

describe('StreamingIndicator Component', () => {
  
  test('should not render when status is idle', () => {
    const { container } = render(<StreamingIndicator status="idle" />);
    expect(container.firstChild).toBeNull();
  });

  test('should render thinking state with spinner', () => {
    render(<StreamingIndicator status="thinking" />);
    
    expect(screen.getByText('Pensando...')).toBeInTheDocument();
    const spinner = document.querySelector('.streaming-spinner');
    expect(spinner).toBeInTheDocument();
    expect(spinner.querySelectorAll('.streaming-spinner-dot')).toHaveLength(3);
  });

  test('should display thinking time in thinking state', () => {
    render(<StreamingIndicator status="thinking" thinkingMs={250} />);
    
    expect(screen.getByText('Pensando...')).toBeInTheDocument();
    expect(screen.getByText('(0.25s)')).toBeInTheDocument();
  });

  test('should render streaming state with token animation', () => {
    render(<StreamingIndicator status="streaming" ttft={500} />);
    
    expect(screen.getByText('Streaming respuesta...')).toBeInTheDocument();
    const tokens = document.querySelectorAll('.streaming-token');
    expect(tokens).toHaveLength(3);
  });

  test('should display TTFT in streaming state', () => {
    render(<StreamingIndicator status="streaming" ttft={725} />);
    
    expect(screen.getByText('Streaming respuesta...')).toBeInTheDocument();
    expect(screen.getByText('Listo en 0.72s')).toBeInTheDocument();
  });

  test('should render finalizing state with fade out animation', () => {
    render(<StreamingIndicator status="finalizing" />);
    
    expect(screen.getByText('Finalizando...')).toBeInTheDocument();
    const indicator = document.querySelector('.streaming-indicator--finalizing');
    expect(indicator).toBeInTheDocument();
  });

  test('should render error state with message and retry button', () => {
    render(
      <StreamingIndicator
        status="error"
        errorMessage="Connection failed"
        onRetry={() => {}}
      />
    );
    
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  test('should use default error message when not provided', () => {
    render(
      <StreamingIndicator status="error" />
    );
    
    expect(screen.getByText('Error en la solicitud')).toBeInTheDocument();
  });

  test('should call onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    
    render(
      <StreamingIndicator
        status="error"
        errorMessage="Network error"
        onRetry={onRetry}
      />
    );
    
    const retryButton = screen.getByRole('button', { name: /reintentar/i });
    await user.click(retryButton);
    
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('should not render retry button when onRetry is not provided', () => {
    render(
      <StreamingIndicator
        status="error"
        errorMessage="Network error"
      />
    );
    
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
  });

  test('should render done state with completion message', () => {
    render(<StreamingIndicator status="done" />);
    
    expect(screen.getByText('✓ Completado')).toBeInTheDocument();
    const indicator = document.querySelector('.streaming-indicator--done');
    expect(indicator).toBeInTheDocument();
  });

  test('should format ms to seconds correctly', () => {
    // Test various ms values
    const { rerender } = render(
      <StreamingIndicator status="streaming" ttft={1000} />
    );
    expect(screen.getByText('Listo en 1.00s')).toBeInTheDocument();

    rerender(<StreamingIndicator status="streaming" ttft={1234} />);
    expect(screen.getByText('Listo en 1.23s')).toBeInTheDocument();

    rerender(<StreamingIndicator status="streaming" ttft={50} />);
    expect(screen.getByText('Listo en 0.05s')).toBeInTheDocument();
  });

  test('should have correct CSS classes for different states', () => {
    const { rerender } = render(
      <StreamingIndicator status="thinking" />
    );
    expect(document.querySelector('.streaming-indicator--thinking')).toBeInTheDocument();

    rerender(<StreamingIndicator status="streaming" />);
    expect(document.querySelector('.streaming-indicator--streaming')).toBeInTheDocument();

    rerender(<StreamingIndicator status="error" />);
    expect(document.querySelector('.streaming-indicator--error')).toBeInTheDocument();

    rerender(<StreamingIndicator status="done" />);
    expect(document.querySelector('.streaming-indicator--done')).toBeInTheDocument();

    rerender(<StreamingIndicator status="finalizing" />);
    expect(document.querySelector('.streaming-indicator--finalizing')).toBeInTheDocument();
  });

  test('should handle acking status the same as thinking', () => {
    render(<StreamingIndicator status="acking" />);
    
    expect(screen.getByText('Pensando...')).toBeInTheDocument();
    expect(document.querySelector('.streaming-indicator--thinking')).toBeInTheDocument();
  });

  test('should handle generating status the same as streaming', () => {
    render(<StreamingIndicator status="generating" ttft={300} />);
    
    expect(screen.getByText('Streaming respuesta...')).toBeInTheDocument();
    expect(screen.getByText('Listo en 0.30s')).toBeInTheDocument();
  });

  test('should not show TTFT metric with null value', () => {
    render(<StreamingIndicator status="streaming" ttft={null} />);
    
    expect(screen.getByText('Streaming respuesta...')).toBeInTheDocument();
    expect(screen.queryByText(/Listo en/)).not.toBeInTheDocument();
  });

  test('should not show thinking time metric with null value', () => {
    render(<StreamingIndicator status="thinking" thinkingMs={null} />);
    
    expect(screen.getByText('Pensando...')).toBeInTheDocument();
    expect(screen.queryByText(/\(0\./)).not.toBeInTheDocument();
  });
});
