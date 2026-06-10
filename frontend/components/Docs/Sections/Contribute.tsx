import React from 'react';
import { Code, Globe, MapPin, ExternalLink } from 'lucide-react';
import { InfoBox } from '../Common';
import CodeBlock from '../CodeBlock';

const Contribute: React.FC = () => {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Contribute</h1>
                <p className="text-lg text-gray-600">
                    Help improve the OSM Road Closures API project.
                </p>
            </div>

            <InfoBox type="info" title="Google Summer of Code 2025">
                <p>
                    This project is being developed as part of GSoC 2025 with OpenStreetMap.
                    We welcome community contributions and feedback!
                </p>
            </InfoBox>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Development Setup</h2>
                        <CodeBlock
                            code={`# Clone the repository
git clone https://github.com/sosm/temporary-road-closures
cd temporary-road-closures

# Backend setup
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your settings

# Start development server
uvicorn app.main:app --reload

# Frontend setup
cd ../frontend
npm install
npm run dev`}
                            language="bash"
                        />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Testing</h2>
                        <CodeBlock
                            code={`# Run backend tests
cd backend
pytest

# Run with coverage
pytest --cov=app

# Test specific modules
pytest tests/test_closures.py -v`}
                            language="bash"
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Ways to Contribute</h2>
                        <div className="space-y-4">
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900 mb-2">🐛 Bug Reports</h3>
                                <p className="text-gray-600 text-sm">
                                    Found an issue? Please report it with detailed steps to reproduce.
                                </p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900 mb-2">✨ Feature Requests</h3>
                                <p className="text-gray-600 text-sm">
                                    Have an idea for improvement? We'd love to hear about it!
                                </p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900 mb-2">📖 Documentation</h3>
                                <p className="text-gray-600 text-sm">
                                    Help improve documentation, examples, and guides.
                                </p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900 mb-2">🧪 Testing</h3>
                                <p className="text-gray-600 text-sm">
                                    Test the API with real-world data and edge cases.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Code Style</h2>
                        <ul className="space-y-2 text-gray-600">
                            <li className="flex items-start space-x-2">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                                <span><strong>Python:</strong> Black formatter, isort for imports</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                                <span><strong>TypeScript:</strong> ESLint with Next.js rules</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                                <span><strong>Documentation:</strong> Comprehensive docstrings</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                                <span><strong>Testing:</strong> Pytest with good coverage</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Project Links</h2>
                <div className="grid md:grid-cols-3 gap-4">
                    <a
                        href="https://github.com/sosm/temporary-road-closures"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                        <Code className="w-6 h-6 text-gray-600" />
                        <div>
                            <div className="font-semibold text-gray-900">GitHub Repository</div>
                            <div className="text-sm text-gray-600">Source code and issues</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>

                    <a
                        href="https://summerofcode.withgoogle.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                        <Globe className="w-6 h-6 text-gray-600" />
                        <div>
                            <div className="font-semibold text-gray-900">GSoC 2025</div>
                            <div className="text-sm text-gray-600">Project information</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>

                    <a
                        href="https://www.openstreetmap.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                        <MapPin className="w-6 h-6 text-gray-600" />
                        <div>
                            <div className="font-semibold text-gray-900">OpenStreetMap</div>
                            <div className="text-sm text-gray-600">Join the community</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Contribute;