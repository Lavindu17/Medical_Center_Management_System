'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Link as LinkIcon, LogIn, Clock, XCircle, CheckCircle, Mail } from 'lucide-react';

export default function FamilyDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [familyData, setFamilyData] = useState({
        linked_members: [],
        incoming_requests: [],
        outgoing_requests: []
    });

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRelationship, setInviteRelationship] = useState('PARENT');
    const [sendingInvite, setSendingInvite] = useState(false);
    const [switchingAccount, setSwitchingAccount] = useState(false);

    useEffect(() => {
        fetchFamilyData();
    }, []);

    const fetchFamilyData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/patient/family');
            if (res.ok) {
                const data = await res.json();
                setFamilyData(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setSendingInvite(true);
        try {
            const res = await fetch('/api/patient/family/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, relationship: inviteRelationship })
            });
            const data = await res.json();
            if (res.ok) {
                alert('Invite sent successfully!');
                setInviteEmail('');
                fetchFamilyData();
            } else {
                alert(data.message || 'Failed to send invite');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSendingInvite(false);
        }
    };

    const handleRespond = async (requestId: number, action: 'ACCEPT' | 'REJECT') => {
        try {
            const res = await fetch('/api/patient/family/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, action })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Request ${action.toLowerCase()}ed.`);
                fetchFamilyData();
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleSwitchAccount = async (targetUserId: number) => {
        setSwitchingAccount(true);
        try {
            const res = await fetch('/api/auth/switch-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_user_id: targetUserId })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Successfully switched accounts.`);
                window.location.href = '/patient'; // Hard reload to reconstruct state globally
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSwitchingAccount(false);
        }
    };

    if (loading) return <div className="p-8">Loading family portal...</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
                    <Users className="h-8 w-8 text-blue-600" /> Family Network
                </h1>
                <p className="text-neutral-500">Manage linked medical accounts. Authorized family members can view and manage each other's medical records.</p>
            </div>

            <Tabs defaultValue="linked" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-2xl mb-6">
                    <TabsTrigger value="linked">My Family ({familyData.linked_members.length})</TabsTrigger>
                    <TabsTrigger value="requests">Requests ({familyData.incoming_requests.length + familyData.outgoing_requests.length})</TabsTrigger>
                    <TabsTrigger value="add">Add Member</TabsTrigger>
                </TabsList>

                {/* TAB 1: Linked Members */}
                <TabsContent value="linked" className="space-y-4">
                    {familyData.linked_members.length === 0 ? (
                        <Card className="bg-neutral-50 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-neutral-500">
                                <Users className="h-12 w-12 text-neutral-300 mb-4" />
                                <p>You do not have any linked family accounts.</p>
                                <p className="text-sm">Click "Add Member" to connect with a relative.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {familyData.linked_members.map((member: any) => (
                                <Card key={member.link_id} className="border-blue-100 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                                    <CardHeader className="py-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg">{member.name}</CardTitle>
                                                <CardDescription>{member.email}</CardDescription>
                                            </div>
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 capitalize">
                                                {member.relationship.toLowerCase()}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pb-4">
                                        <Button 
                                            onClick={() => handleSwitchAccount(member.member_id)}
                                            disabled={switchingAccount}
                                            className="w-full mt-2" 
                                            variant="secondary"
                                        >
                                            <LogIn className="w-4 h-4 mr-2" /> Switch to {member.name}'s Profile
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* TAB 2: Requests */}
                <TabsContent value="requests" className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                            <LinkIcon className="h-5 w-5 text-neutral-500" /> Incoming Requests
                        </h3>
                        {familyData.incoming_requests.length === 0 ? (
                            <p className="text-sm text-neutral-500 italic">No incoming requests pending.</p>
                        ) : (
                            <div className="space-y-3">
                                {familyData.incoming_requests.map((req: any) => (
                                    <Card key={req.id}>
                                        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <p className="font-medium text-neutral-900">{req.requester_name} <span className="text-neutral-500 font-normal">({req.requester_email})</span></p>
                                                <p className="text-sm text-neutral-500 mt-1">Requested to link as: <strong>{req.relationship}</strong></p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleRespond(req.id, 'REJECT')}>
                                                    <XCircle className="w-4 h-4 mr-2" /> Reject
                                                </Button>
                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleRespond(req.id, 'ACCEPT')}>
                                                    <CheckCircle className="w-4 h-4 mr-2" /> Accept
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                            <Clock className="h-5 w-5 text-neutral-500" /> Outgoing Requests
                        </h3>
                        {familyData.outgoing_requests.length === 0 ? (
                            <p className="text-sm text-neutral-500 italic">No outgoing requests pending.</p>
                        ) : (
                            <div className="space-y-3">
                                {familyData.outgoing_requests.map((req: any) => (
                                    <Card key={req.id}>
                                        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-50">
                                            <div>
                                                <p className="font-medium text-neutral-700">Invite sent to: {req.member_name || req.member_email}</p>
                                                <p className="text-sm text-neutral-500 mt-1">Relationship: <strong>{req.relationship}</strong></p>
                                            </div>
                                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 shrink-0">
                                                Pending Response
                                            </Badge>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* TAB 3: Add Member */}
                <TabsContent value="add" className="space-y-4">
                    <Card className="max-w-xl">
                        <CardHeader>
                            <CardTitle>Send Email Link Request</CardTitle>
                            <CardDescription>
                                Enter the email address of the Sethro Medical patient you wish to link with. They will receive an email and a dashboard notification.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSendInvite} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Patient's Registered Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                                        <Input 
                                            type="email" 
                                            required 
                                            className="pl-10" 
                                            placeholder="patient@example.com"
                                            value={inviteEmail}
                                            onChange={e => setInviteEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Their Relationship to You</Label>
                                    <select 
                                        className="w-full h-10 px-3 py-2 border rounded-md bg-background text-sm ring-offset-background"
                                        value={inviteRelationship}
                                        onChange={e => setInviteRelationship(e.target.value)}
                                    >
                                        <option value="PARENT">Parent</option>
                                        <option value="CHILD">Child</option>
                                        <option value="SPOUSE">Spouse</option>
                                        <option value="SIBLING">Sibling</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <Button type="submit" disabled={sendingInvite} className="w-full mt-4">
                                    {sendingInvite ? 'Sending Invite...' : 'Send Link Request'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
