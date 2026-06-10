import React from 'react';
import { Globe, MapPin, Users, Book, Heart, ExternalLink } from 'lucide-react';
import { FeatureCard } from '../Common';

const Acknowledgements: React.FC = () => {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Acknowledgements</h1>
                <p className="text-lg text-gray-600">
                    This project is made possible by the amazing open source community and supporters.
                </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8">
                <div className="text-center mb-8">
                    <Heart className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Built with ❤️ for the OSM Community</h2>
                    <p className="text-gray-600">
                        This project exists thanks to the support and collaboration of many individuals and organizations.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={Globe}
                        title="Google Summer of Code"
                        description="For supporting open source development and student participation in OSS projects."
                        iconColor="text-blue-600"
                    />
                    <FeatureCard
                        icon={MapPin}
                        title="OpenStreetMap Foundation"
                        description="For providing the platform and community that makes this project valuable."
                        iconColor="text-green-600"
                    />
                    <FeatureCard
                        icon={Users}
                        title="Project Mentors"
                        description="Simon Poole and Ian Wagner for their guidance, expertise, and support."
                        iconColor="text-purple-600"
                    />
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Special Thanks</h2>
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Open Source Tools & Libraries</h3>
                                <ul className="space-y-2 text-gray-600">
                                    <li>• <strong>FastAPI Team</strong> - Outstanding web framework</li>
                                    <li>• <strong>PostGIS Team</strong> - Excellent geospatial database capabilities</li>
                                    <li>• <strong>PostgreSQL Community</strong> - Robust database foundation</li>
                                    <li>• <strong>Python Ecosystem</strong> - Rich libraries and tools</li>
                                    <li>• <strong>React & Next.js Teams</strong> - Modern frontend framework</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Standards & Specifications</h3>
                                <ul className="space-y-2 text-gray-600">
                                    <li>• <strong>TomTom</strong> - OpenLR specification and reference implementations</li>
                                    <li>• <strong>OGC</strong> - Open geospatial standards</li>
                                    <li>• <strong>OpenAPI Initiative</strong> - API specification standards</li>
                                    <li>• <strong>OSM Community</strong> - Map data standards and practices</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Project Team</h2>
                    <div className="bg-gray-50 rounded-lg p-6">
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Users className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="font-semibold text-gray-900">Archit Rathod</h3>
                                <p className="text-gray-600 text-sm">Student Developer</p>
                                <p className="text-gray-500 text-xs mt-1">University of Illinois Chicago</p>
                            </div>

                            <div className="text-center">
                                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Users className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="font-semibold text-gray-900">Simon Poole</h3>
                                <p className="text-gray-600 text-sm">Project Mentor</p>
                                <p className="text-gray-500 text-xs mt-1">OpenStreetMap Foundation</p>
                            </div>

                            <div className="text-center">
                                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Users className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="font-semibold text-gray-900">Ian Wagner</h3>
                                <p className="text-gray-600 text-sm">Project Mentor</p>
                                <p className="text-gray-500 text-xs mt-1">Stadia Maps</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">University Support</h2>
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-start space-x-4">
                            <Book className="w-8 h-8 text-blue-600 mt-1" />
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">University of Illinois Chicago</h3>
                                <p className="text-gray-600 mb-3">
                                    For providing academic support and research opportunities that made this project possible.
                                    Special thanks to the Computer Science department for fostering innovation in geospatial technologies.
                                </p>
                                <p className="text-gray-500 text-sm">
                                    MS Computer Science Program • Data Science & Geospatial Analytics Track
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">Community Recognition</h3>
                    <p className="text-blue-700 mb-4">
                        We acknowledge the foundational work of OSM contributors worldwide and the open-source
                        ecosystem that makes projects like this possible. Every bug report, feature suggestion,
                        and piece of feedback helps make this project better.
                    </p>
                    <div className="flex justify-center space-x-6">
                        <a
                            href="https://github.com/sosm/temporary-road-closures/stargazers"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                            ⭐ Star the project on GitHub
                        </a>
                        <a
                            href="https://github.com/sosm/temporary-road-closures/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                            💬 Join the discussion
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Acknowledgements;