import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Ghost, MessageSquare, Mic, Monitor, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRoomSchema, type InsertRoom } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import image1 from "@assets/ChatGPT Image Nov 25, 2025, 06_40_24 PM_1764191715699.png";
import image2 from "@assets/ChatGPT Image Nov 25, 2025, 06_58_04 PM_1764191759271.png";
import image3 from "@assets/ChatGPT Image Nov 25, 2025, 07_27_30 PM_1764191734113.png";
import image4 from "@assets/ChatGPT Image Nov 25, 2025, 07_39_52 PM_1764191702736.png";

const CAROUSEL_IMAGES = [image1, image2, image3, image4];

export default function Landing() {
  const [, setLocation] = useLocation();
  const [roomCode, setRoomCode] = useState("");
  const [username, setUsername] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, []);

  const form = useForm<InsertRoom>({
    resolver: zodResolver(insertRoomSchema),
    defaultValues: {
      name: "",
    },
  });

  const handleCreateRoom = (data: InsertRoom) => {
    if (!username.trim()) return;
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    sessionStorage.setItem("username", username);
    sessionStorage.setItem("roomName", data.name);
    sessionStorage.setItem("roomCode", roomCode);
    setLocation(`/room/${roomCode}`);
  };

  const handleJoinRoom = () => {
    if (!username.trim() || !roomCode.trim()) return;
    sessionStorage.setItem("username", username);
    setLocation(`/room/${roomCode.toUpperCase()}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background spooky-bg relative z-10">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl space-y-8">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Ghost className="w-12 h-12 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-400 to-primary bg-clip-text text-transparent">
                Phasmophobia Broads
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Your private gaming communication hub. Chat, voice, and stream with your crew in atmospheric horror-themed rooms.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-[480px] relative">
              <div className="overflow-hidden rounded-md">
                <img
                  src={CAROUSEL_IMAGES[currentSlide]}
                  alt={`Phasmophobia Broads ${currentSlide + 1}`}
                  className="w-full h-auto rounded-md transition-opacity duration-500"
                  data-testid={`carousel-image-${currentSlide}`}
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setCurrentSlide((prev) => (prev - 1 + CAROUSEL_IMAGES.length) % CAROUSEL_IMAGES.length)}
                data-testid="button-carousel-prev"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setCurrentSlide((prev) => (prev + 1) % CAROUSEL_IMAGES.length)}
                data-testid="button-carousel-next"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Card className="hover-elevate active-elevate-2 cursor-pointer transition-all">
                  <CardHeader className="space-y-1">
                    <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mb-2">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Create Room</CardTitle>
                    <CardDescription>
                      Start a new room and invite your friends
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" size="lg" data-testid="button-create-room">
                      Create New Room
                    </Button>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create a New Room</DialogTitle>
                  <DialogDescription>
                    Give your room a name and share the code with friends
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleCreateRoom)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Your Username</Label>
                      <Input
                        id="username"
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        data-testid="input-username-create"
                        required
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Room Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Friday Night Gaming"
                              {...field}
                              data-testid="input-room-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" size="lg" data-testid="button-submit-create">
                      Create Room
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Card className="hover-elevate active-elevate-2 cursor-pointer transition-all">
                  <CardHeader className="space-y-1">
                    <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mb-2">
                      <MessageSquare className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Join Room</CardTitle>
                    <CardDescription>
                      Enter a room code to join your friends
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full" size="lg" data-testid="button-join-room">
                      Join Existing Room
                    </Button>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Join a Room</DialogTitle>
                  <DialogDescription>
                    Enter the room code shared by your friend
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="join-username">Your Username</Label>
                    <Input
                      id="join-username"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      data-testid="input-username-join"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room-code">Room Code</Label>
                    <Input
                      id="room-code"
                      placeholder="Enter 6-character code"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="font-mono text-lg tracking-wider"
                      data-testid="input-room-code"
                      required
                    />
                  </div>
                  <Button 
                    onClick={handleJoinRoom} 
                    className="w-full" 
                    size="lg"
                    data-testid="button-submit-join"
                    disabled={!username.trim() || !roomCode.trim()}
                  >
                    Join Room
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-center text-xl">Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-medium">Real-time Chat</h3>
                  <p className="text-sm text-muted-foreground">
                    Instant messaging with typing indicators
                  </p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 rounded-md bg-voice-active/10 flex items-center justify-center mx-auto">
                    <Mic className="w-5 h-5 text-voice-active" />
                  </div>
                  <h3 className="font-medium">Voice Chat</h3>
                  <p className="text-sm text-muted-foreground">
                    Group voice with presence indicators
                  </p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                    <Monitor className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-medium">Screen Share</h3>
                  <p className="text-sm text-muted-foreground">
                    Stream your gameplay to friends
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="py-6 px-4 border-t">
        <p className="text-center text-sm text-muted-foreground">
          Built for gamers, by gamers. Keep it spooky.
        </p>
      </footer>
    </div>
  );
}
