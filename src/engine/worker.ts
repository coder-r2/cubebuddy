import { expose } from 'comlink';
import { engine } from './api';

// The engine runs off the main thread so table building and searches never block input (D-036).
expose(engine);
